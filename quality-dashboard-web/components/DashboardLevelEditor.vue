<template>
  <div class="level-editor">
    <p v-if="modelValue.length === 0" class="hint empty-hint">
      No levels yet. Add a top-level criterion to start building the tree.
    </p>
    <ul class="level-list root">
      <DashboardLevelEditorRow
        v-for="(node, i) in modelValue"
        :key="node.id"
        :node="node"
        :path="[i]"
        :siblings-count="modelValue.length"
        :ancestor-tags="[]"
        :tag-names="tagNames"
        :get-values-for-tag="getValuesForTag"
        :duplicate-set="duplicateAncestorTagNodeIds"
        @update="onUpdate"
        @add-child="onAddChild"
        @add-sibling="onAddSibling"
        @move-up="onMoveUp"
        @move-down="onMoveDown"
        @indent="onIndent"
        @outdent="onOutdent"
        @remove="onRemove"
      />
    </ul>
    <button class="btn-secondary add-root" @click="addRootNode">
      <i class="bi bi-plus"></i> Add level
    </button>
  </div>
</template>

<script setup lang="ts">
import type { DashboardLevelNode } from "~~/stores/DashboardsStore";

const props = defineProps<{
  modelValue: DashboardLevelNode[];
  tagNames: string[];
  getValuesForTag: (tag: string) => string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: DashboardLevelNode[]];
}>();

function genId(): string {
  // crypto.randomUUID is widely available in browsers; fall back to a timestamp+random.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function emitTree(next: DashboardLevelNode[]): void {
  emit("update:modelValue", next);
}

/** Deep-clone the entire tree to avoid mutating props directly. */
function cloneTree(nodes: DashboardLevelNode[]): DashboardLevelNode[] {
  return nodes.map((n) => ({
    id: n.id,
    tag: n.tag,
    value: n.value,
    children: cloneTree(n.children || []),
  }));
}

/** Walk the tree to the parent array of the node at `path` and return it. */
function parentArrayAt(
  tree: DashboardLevelNode[],
  path: number[],
): DashboardLevelNode[] {
  let arr = tree;
  for (let i = 0; i < path.length - 1; i++) {
    const idx = path[i] as number;
    arr = (arr[idx] as DashboardLevelNode).children;
  }
  return arr;
}

function lastIdx(path: number[]): number {
  return path[path.length - 1] as number;
}

function nodeAt(
  tree: DashboardLevelNode[],
  path: number[],
): DashboardLevelNode {
  return parentArrayAt(tree, path)[lastIdx(path)] as DashboardLevelNode;
}

function blankNode(): DashboardLevelNode {
  return { id: genId(), tag: "", value: undefined, children: [] };
}

function addRootNode(): void {
  const next = cloneTree(props.modelValue);
  next.push(blankNode());
  emitTree(next);
}

function onUpdate(payload: {
  path: number[];
  patch: Partial<Pick<DashboardLevelNode, "tag" | "value">>;
}): void {
  const next = cloneTree(props.modelValue);
  const node = nodeAt(next, payload.path);
  if (payload.patch.tag !== undefined) {
    node.tag = payload.patch.tag;
  }
  if ("value" in payload.patch) {
    const v = payload.patch.value;
    node.value = v && v.trim() ? v.trim() : undefined;
  }
  emitTree(next);
}

function onAddChild(payload: { path: number[] }): void {
  const next = cloneTree(props.modelValue);
  const node = nodeAt(next, payload.path);
  node.children.push(blankNode());
  emitTree(next);
}

function onAddSibling(payload: { path: number[] }): void {
  const next = cloneTree(props.modelValue);
  const arr = parentArrayAt(next, payload.path);
  const idx = lastIdx(payload.path);
  arr.splice(idx + 1, 0, blankNode());
  emitTree(next);
}

function onMoveUp(payload: { path: number[] }): void {
  const next = cloneTree(props.modelValue);
  const arr = parentArrayAt(next, payload.path);
  const idx = lastIdx(payload.path);
  if (idx <= 0) return;
  const [n] = arr.splice(idx, 1) as [DashboardLevelNode];
  arr.splice(idx - 1, 0, n);
  emitTree(next);
}

function onMoveDown(payload: { path: number[] }): void {
  const next = cloneTree(props.modelValue);
  const arr = parentArrayAt(next, payload.path);
  const idx = lastIdx(payload.path);
  if (idx >= arr.length - 1) return;
  const [n] = arr.splice(idx, 1) as [DashboardLevelNode];
  arr.splice(idx + 1, 0, n);
  emitTree(next);
}

/** Make this node a child of the previous sibling. */
function onIndent(payload: { path: number[] }): void {
  const next = cloneTree(props.modelValue);
  const arr = parentArrayAt(next, payload.path);
  const idx = lastIdx(payload.path);
  if (idx <= 0) return;
  const [n] = arr.splice(idx, 1) as [DashboardLevelNode];
  (arr[idx - 1] as DashboardLevelNode).children.push(n);
  emitTree(next);
}

/** Move this node out: place it as a sibling of its parent, just after the parent. */
function onOutdent(payload: { path: number[] }): void {
  if (payload.path.length < 2) return;
  const next = cloneTree(props.modelValue);
  const arr = parentArrayAt(next, payload.path);
  const idx = lastIdx(payload.path);
  const [n] = arr.splice(idx, 1) as [DashboardLevelNode];
  // The parent's parent array.
  const parentPath = payload.path.slice(0, -1);
  const grandArr = parentArrayAt(next, parentPath);
  const parentIdx = lastIdx(parentPath);
  grandArr.splice(parentIdx + 1, 0, n);
  emitTree(next);
}

function onRemove(payload: { path: number[] }): void {
  const next = cloneTree(props.modelValue);
  const arr = parentArrayAt(next, payload.path);
  const idx = lastIdx(payload.path);
  arr.splice(idx, 1);
  emitTree(next);
}

/** Compute the set of node ids that conflict with an ancestor tag (duplicate on branch). */
const duplicateAncestorTagNodeIds = computed(() => {
  const dup = new Set<string>();
  function walk(nodes: DashboardLevelNode[], ancestors: string[]): void {
    for (const n of nodes) {
      const tag = (n.tag || "").trim();
      if (tag && ancestors.indexOf(tag) !== -1) {
        dup.add(n.id);
      }
      walk(n.children || [], tag ? [...ancestors, tag] : ancestors);
    }
  }
  walk(props.modelValue, []);
  return dup;
});
</script>

<style scoped>
.level-editor {
  margin-top: 0.3em;
}
.level-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.level-list.root {
  margin-bottom: 0.4em;
}
.empty-hint {
  font-style: italic;
  margin: 0.2em 0 0.4em;
}
.add-root {
  margin-top: 0.2em;
}
.hint {
  font-size: 0.8em;
  color: #78909c;
}
</style>
