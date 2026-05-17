<template>
  <li class="level-row-item">
    <div class="row-line" :class="{ invalid: !isValidTag || isDuplicate }">
      <button
        class="grip-btn"
        title="Drag handle (use buttons below to reorder)"
        tabindex="-1"
        type="button"
      >
        <i class="bi bi-list-nested"></i>
      </button>
      <div class="row-fields">
        <TagEditField
          :tag="node.tag"
          :value="node.value || ''"
          :tag-suggestions="tagNames"
          :value-suggestions="getValuesForTag(node.tag)"
          tag-placeholder="tag"
          value-placeholder="(any value)"
          @update:tag="(v: string) => emitUpdate({ tag: v })"
          @update:value="(v: string) => emitUpdate({ value: v })"
        />
      </div>
      <div class="row-actions">
        <button
          class="icon-btn"
          :disabled="!canMoveUp"
          title="Move up"
          @click="$emit('move-up', { path })"
          type="button"
        >
          <i class="bi bi-arrow-up"></i>
        </button>
        <button
          class="icon-btn"
          :disabled="!canMoveDown"
          title="Move down"
          @click="$emit('move-down', { path })"
          type="button"
        >
          <i class="bi bi-arrow-down"></i>
        </button>
        <button
          class="icon-btn"
          :disabled="!canIndent"
          title="Make child of previous sibling"
          @click="$emit('indent', { path })"
          type="button"
        >
          <i class="bi bi-arrow-right-short"></i>
        </button>
        <button
          class="icon-btn"
          :disabled="!canOutdent"
          title="Move out one level"
          @click="$emit('outdent', { path })"
          type="button"
        >
          <i class="bi bi-arrow-left-short"></i>
        </button>
        <button
          class="icon-btn"
          title="Add sub-level"
          @click="$emit('add-child', { path })"
          type="button"
        >
          <i class="bi bi-plus-square"></i>
        </button>
        <button
          class="icon-btn"
          title="Add level after"
          @click="$emit('add-sibling', { path })"
          type="button"
        >
          <i class="bi bi-plus"></i>
        </button>
        <button
          class="icon-btn danger"
          title="Delete"
          @click="$emit('remove', { path })"
          type="button"
        >
          <i class="bi bi-x-circle"></i>
        </button>
      </div>
    </div>
    <p v-if="!isValidTag" class="row-error">Tag is required.</p>
    <p v-else-if="isDuplicate" class="row-error">
      Tag already used on this branch.
    </p>
    <ul v-if="node.children.length > 0" class="level-list children">
      <DashboardLevelEditorRow
        v-for="(child, i) in node.children"
        :key="child.id"
        :node="child"
        :path="[...path, i]"
        :siblings-count="node.children.length"
        :ancestor-tags="ancestorTagsForChildren"
        :tag-names="tagNames"
        :get-values-for-tag="getValuesForTag"
        :duplicate-set="duplicateSet"
        @update="(p: { path: number[]; patch: any }) => $emit('update', p)"
        @add-child="(p: { path: number[] }) => $emit('add-child', p)"
        @add-sibling="(p: { path: number[] }) => $emit('add-sibling', p)"
        @move-up="(p: { path: number[] }) => $emit('move-up', p)"
        @move-down="(p: { path: number[] }) => $emit('move-down', p)"
        @indent="(p: { path: number[] }) => $emit('indent', p)"
        @outdent="(p: { path: number[] }) => $emit('outdent', p)"
        @remove="(p: { path: number[] }) => $emit('remove', p)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import type { DashboardLevelNode } from "~~/stores/DashboardsStore";

const props = defineProps<{
  node: DashboardLevelNode;
  path: number[];
  siblingsCount: number;
  ancestorTags: string[];
  tagNames: string[];
  getValuesForTag: (tag: string) => string[];
  duplicateSet: Set<string>;
}>();

const emit = defineEmits<{
  update: [
    payload: {
      path: number[];
      patch: Partial<Pick<DashboardLevelNode, "tag" | "value">>;
    },
  ];
  "add-child": [payload: { path: number[] }];
  "add-sibling": [payload: { path: number[] }];
  "move-up": [payload: { path: number[] }];
  "move-down": [payload: { path: number[] }];
  indent: [payload: { path: number[] }];
  outdent: [payload: { path: number[] }];
  remove: [payload: { path: number[] }];
}>();

function emitUpdate(
  patch: Partial<Pick<DashboardLevelNode, "tag" | "value">>,
): void {
  emit("update", { path: props.path, patch });
}

const lastSegment = computed(() => props.path[props.path.length - 1] as number);

const canMoveUp = computed(() => lastSegment.value > 0);
const canMoveDown = computed(() => lastSegment.value < props.siblingsCount - 1);
const canIndent = computed(() => lastSegment.value > 0);
const canOutdent = computed(() => props.path.length > 1);

const isValidTag = computed(() => !!(props.node.tag || "").trim());
const isDuplicate = computed(() => props.duplicateSet.has(props.node.id));

const ancestorTagsForChildren = computed(() => {
  const t = (props.node.tag || "").trim();
  return t ? [...props.ancestorTags, t] : props.ancestorTags;
});
</script>

<style scoped>
.level-row-item {
  list-style: none;
}
.row-line {
  display: flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.25em 0;
  border-radius: 4px;
}
.row-line.invalid {
  background: #fff8e1;
}
.grip-btn {
  background: transparent;
  border: none;
  color: #b0bec5;
  cursor: default;
  padding: 0 0.1em;
}
.row-fields {
  display: flex;
  align-items: center;
  gap: 0.25em;
  flex: 1;
  min-width: 0;
}
.row-actions {
  display: flex;
  align-items: center;
  gap: 0.15em;
  flex-shrink: 0;
}
.icon-btn {
  background: transparent;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  padding: 0.15em 0.35em;
  cursor: pointer;
  color: #455a64;
  font-size: 0.85em;
  line-height: 1;
}
.icon-btn:hover:not(:disabled) {
  background: #eceff1;
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.icon-btn.danger:hover:not(:disabled) {
  color: #c62828;
  border-color: #c62828;
}
.row-error {
  font-size: 0.75em;
  color: #c62828;
  margin: 0 0 0.1em 2em;
}
.level-list.children {
  list-style: none;
  padding: 0 0 0 1.4em;
  margin: 0;
  border-left: 2px solid #eceff1;
}
@media (prefers-color-scheme: dark) {
  .row-line.invalid {
    background: #3e2723;
  }
  .icon-btn {
    background: transparent;
    border-color: #455a64;
    color: #cfd8dc;
  }
  .icon-btn:hover:not(:disabled) {
    background: #263238;
  }
  .icon-btn.danger:hover:not(:disabled) {
    color: #ff6659;
    border-color: #ff6659;
  }
  .level-list.children {
    border-left-color: #37474f;
  }
  .row-error {
    color: #ff8a80;
  }
}
</style>
