<template>
  <div class="page dashboards-page">
    <div v-if="dashboardsStore.lastError && !selectedId" class="error">
      {{ dashboardsStore.lastError }}
    </div>

    <div
      v-if="
        !dashboardsStore.isFetching && dashboardsStore.dashboards.length === 0
      "
      class="empty"
    >
      No dashboards yet.
    </div>

    <template v-else>
      <div class="dashboards-tabs-wrap">
        <button
          class="scroll-arrow scroll-left"
          @click="scrollTabs($event, -1)"
          title="Scroll left"
        >
          <i class="bi bi-chevron-left"></i>
        </button>
        <div class="dashboards-tabs" ref="tabsRef">
          <button
            v-for="d in dashboardsStore.dashboards"
            :key="d.id"
            class="tab-item"
            :class="{ active: selectedId === d.id }"
            @click="selectDashboard(d.id)"
          >
            {{ d.name }}
          </button>
        </div>
        <button
          class="scroll-arrow scroll-right"
          @click="scrollTabs($event, 1)"
          title="Scroll right"
        >
          <i class="bi bi-chevron-right"></i>
        </button>
        <button
          v-if="authenticationStore.isAuthenticated"
          class="btn-primary"
          @click="openCreate"
        >
          <i class="bi bi-plus"></i> New
        </button>
      </div>

      <div class="dashboard-content">
        <div v-if="loadingData" class="loading">Loading...</div>

        <div v-else-if="!selectedData" class="empty">
          Select a dashboard to view its reports.
        </div>

        <div v-else-if="dashboardsStore.lastError" class="error">
          <i class="bi bi-exclamation-triangle-fill"></i>
          {{ dashboardsStore.lastError }}
        </div>

        <div v-else>
          <div class="dashboard-header">
            <h3>{{ selectedData.dashboard.name }}</h3>
            <div class="header-actions">
              <button
                class="icon-btn"
                @click="broadcastExpand(true)"
                title="Expand all"
              >
                <i class="bi bi-arrows-expand"></i>
              </button>
              <button
                class="icon-btn"
                @click="broadcastExpand(false)"
                title="Collapse all"
              >
                <i class="bi bi-arrows-collapse"></i>
              </button>
              <button
                v-if="authenticationStore.isAuthenticated"
                class="icon-btn"
                @click="openEdit(selectedData.dashboard)"
                title="Edit dashboard"
              >
                <i class="bi bi-pencil"></i>
              </button>
              <button
                v-if="authenticationStore.isAuthenticated"
                class="icon-btn danger"
                @click="deleteSelected"
                title="Delete dashboard"
              >
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>

          <p class="levels-summary">
            Levels:
            <code v-if="rootSummary">{{ rootSummary }}</code>
            <span v-else class="empty-inline">(none)</span>
          </p>

          <div v-if="aggregatedTree.length === 0" class="empty">
            No reports match this dashboard yet.
          </div>

          <DashboardNode
            v-for="node in aggregatedTree"
            :key="node.path"
            :node="node"
            :default-expanded="false"
            :expand-bus="expandBus"
          />
        </div>
      </div>
    </template>

    <div v-if="showCreate || showEdit" class="modal">
      <div class="modal-card">
        <h3>{{ editingDashboard ? "Edit dashboard" : "New dashboard" }}</h3>
        <label>Name</label>
        <input v-model="editName" placeholder="My dashboard" />

        <label>Levels</label>
        <p class="hint">
          Build a tree of criteria. Each level is a tag (group by every value)
          or a tag=value (filter). Add sub-levels to break a branch down
          further. Reports are placed at their deepest matching level.
        </p>

        <DashboardLevelEditor
          v-model="editRoot"
          :tag-names="tagsStore.tagNames"
          :get-values-for-tag="tagsStore.valuesForTag"
        />

        <p v-if="treeValidationError" class="modal-error">
          {{ treeValidationError }}
        </p>

        <div class="modal-actions">
          <button class="btn-secondary" @click="cancelEdit">Cancel</button>
          <button
            v-if="editingDashboard"
            class="btn-danger"
            @click="onDeleteFromModal"
          >
            <i class="bi bi-trash"></i> Delete
          </button>
          <button class="btn-primary" :disabled="!canSave" @click="saveEdit">
            {{ editingDashboard ? "Save" : "Create" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";
import {
  buildDashboardTree,
  type AggregatedNode,
} from "~~/services/DashboardAggregator";
import type {
  Dashboard,
  DashboardData,
  DashboardLevelNode,
} from "~~/stores/DashboardsStore";
import type { ExpandBus } from "~~/components/DashboardNode.vue";

const dashboardsStore = DashboardsStore();
const tagsStore = TagsStore();
const reportsStore = ReportsStore();
const authenticationStore = AuthenticationStore();
const applicationSettingsStore = ApplicationSetttingsStore();
const router = useRouter();

const tabsRef = ref<HTMLElement | null>(null);

const showCreate = ref(false);
const showEdit = ref(false);
const editingDashboard = ref<Dashboard | null>(null);
const editName = ref("");
const editRoot = ref<DashboardLevelNode[]>([]);

const selectedId = ref<string | null>(null);
const selectedData = ref<DashboardData | null>(null);
const loadingData = ref(false);

const expandBus = reactive<ExpandBus>({ token: 0, expanded: false });

const aggregatedTree = computed<AggregatedNode[]>(() => {
  if (!selectedData.value) return [];
  return buildDashboardTree(
    selectedData.value.dashboard.root,
    selectedData.value.reports,
  );
});

const rootSummary = computed(() => {
  if (!selectedData.value) return "";
  const root = selectedData.value.dashboard.root;
  if (!root || root.length === 0) return "";
  return root.map((n) => (n.value ? `${n.tag}=${n.value}` : n.tag)).join(" | ");
});

/** Walk the editor tree to find structural problems. */
const treeValidationError = computed<string | null>(() => {
  function walk(
    nodes: DashboardLevelNode[],
    ancestors: string[],
  ): string | null {
    for (const n of nodes) {
      const tag = (n.tag || "").trim();
      if (!tag) {
        return "All levels must have a tag.";
      }
      if (ancestors.indexOf(tag) !== -1) {
        return `Tag "${tag}" is used twice on the same branch.`;
      }
      const sub = walk(n.children || [], [...ancestors, tag]);
      if (sub) return sub;
    }
    return null;
  }
  return walk(editRoot.value, []);
});

const canSave = computed(
  () => !!editName.value.trim() && !treeValidationError.value,
);

onMounted(async () => {
  await applicationSettingsStore.refresh();
  const isAuth = await AuthService.isAuthenticated();
  if (!isAuth) {
    if (!applicationSettingsStore.isInitialized) {
      router.push({ path: "/users/initialize" });
      return;
    }
    if (!applicationSettingsStore.isDashboardPublic) {
      router.push({ path: "/users/login" });
      return;
    }
  }
  await Promise.all([
    tagsStore.fetchAll(),
    dashboardsStore.fetchAll(),
    reportsStore.fetchReports(),
  ]);
  const first = dashboardsStore.dashboards[0];
  if (first) {
    selectDashboard(first.id);
  }
});

async function selectDashboard(id: string): Promise<void> {
  selectedId.value = id;
  loadingData.value = true;
  try {
    selectedData.value = await dashboardsStore.fetchDashboardData(id);
  } finally {
    loadingData.value = false;
  }
}

function scrollTabs(ev: MouseEvent, dir: number): void {
  const btn = ev.currentTarget as HTMLElement;
  if (!btn) return;
  const wrap = btn.closest(".dashboards-tabs-wrap") as HTMLElement | null;
  if (!wrap) return;
  const tabs = wrap.querySelector(".dashboards-tabs") as HTMLElement | null;
  if (!tabs) return;
  tabs.scrollBy({ left: dir * 200, behavior: "smooth" });
}

function broadcastExpand(expanded: boolean): void {
  expandBus.expanded = expanded;
  expandBus.token = expandBus.token + 1;
}

function cloneRoot(nodes: DashboardLevelNode[]): DashboardLevelNode[] {
  return nodes.map((n) => ({
    id: n.id,
    tag: n.tag,
    value: n.value,
    children: cloneRoot(n.children || []),
  }));
}

function openCreate(): void {
  editingDashboard.value = null;
  editName.value = "";
  editRoot.value = [];
  showCreate.value = true;
}

function openEdit(d: Dashboard): void {
  editingDashboard.value = d;
  editName.value = d.name;
  editRoot.value = cloneRoot(d.root || []);
  showEdit.value = true;
}

function cancelEdit(): void {
  showCreate.value = false;
  showEdit.value = false;
  editingDashboard.value = null;
  editName.value = "";
  editRoot.value = [];
}

async function saveEdit(): Promise<void> {
  if (!canSave.value) return;
  const name = editName.value.trim();
  const root = editRoot.value;
  if (editingDashboard.value) {
    await dashboardsStore.update(editingDashboard.value.id, name, root);
    await selectDashboard(editingDashboard.value.id);
  } else {
    const created = await dashboardsStore.create(name, root);
    selectedId.value = created.id;
    selectedData.value = {
      dashboard: created,
      reports: [],
    };
    await selectDashboard(created.id);
  }
  cancelEdit();
  await dashboardsStore.fetchAll();
}

async function deleteSelected(): Promise<void> {
  if (!selectedData.value) return;
  if (!confirm(`Delete dashboard "${selectedData.value.dashboard.name}"?`))
    return;
  const deletedId = selectedData.value.dashboard.id;
  await dashboardsStore.remove(deletedId);
  selectedData.value = null;
  selectedId.value = null;
  if (dashboardsStore.dashboards.length > 0) {
    const first = dashboardsStore.dashboards[0];
    if (first) {
      selectDashboard(first.id);
    }
  }
}

async function onDelete(d: Dashboard): Promise<void> {
  if (!confirm(`Delete dashboard "${d.name}"?`)) return;
  await dashboardsStore.remove(d.id);
  if (selectedId.value === d.id) {
    selectedData.value = null;
    selectedId.value = null;
    if (dashboardsStore.dashboards.length > 0) {
      const first = dashboardsStore.dashboards[0];
      if (first) {
        selectDashboard(first.id);
      }
    }
  }
  await dashboardsStore.fetchAll();
}

async function onDeleteFromModal(): Promise<void> {
  if (!editingDashboard.value) return;
  await onDelete(editingDashboard.value);
  cancelEdit();
}
</script>

<style scoped>
.dashboards-page {
  padding: 0.5em 0.5em 2em;
}
.dashboards-tabs-wrap {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 0.3em;
  margin-bottom: 0.8em;
}
.dashboards-tabs {
  display: flex;
  gap: 0.3em;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0.2em 0;
  flex: 1;
}
.dashboards-tabs::-webkit-scrollbar {
  display: none;
}
.tab-item {
  white-space: nowrap;
  padding: 0.35em 0.8em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85em;
  color: #455a64;
  flex-shrink: 0;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.tab-item:hover {
  background: #eceff1;
}
.tab-item.active {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}
.scroll-arrow {
  background: transparent;
  border: none;
  color: #90a4ae;
  cursor: pointer;
  padding: 0 0.1em;
  font-size: 0.8em;
  flex-shrink: 0;
  opacity: 0.4;
  transition: opacity 0.15s;
}
.dashboards-tabs-wrap:hover .scroll-arrow {
  opacity: 1;
}
.scroll-arrow:hover {
  color: #455a64;
}
.dashboard-content {
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  padding: 0.8em;
  background: #fff;
}
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-bottom: 0;
}
.dashboard-header h3 {
  margin: 0;
}
.header-actions {
  display: flex;
  gap: 0.4em;
}
.levels-summary {
  font-size: 0.85em;
  color: #607d8b;
  margin: 0.2em 0 1em;
}
.levels-summary code {
  font-family: ui-monospace, monospace;
}
.empty-inline {
  font-style: italic;
  color: #90a4ae;
}
.loading,
.empty {
  text-align: center;
  padding: 1.5em;
  color: #78909c;
}
.error {
  text-align: center;
  padding: 1em;
  color: #bf360c;
  background: #fff3e0;
  border: 1px solid #ffccbc;
  border-radius: 4px;
  margin-bottom: 0.8em;
}
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: #fff;
  border-radius: 6px;
  padding: 1em 1.2em;
  width: min(640px, 94vw);
  max-height: 90vh;
  overflow-y: auto;
}
.modal-card label {
  display: block;
  margin-top: 0.5em;
  font-weight: 600;
  font-size: 0.9em;
}
.modal-card input {
  width: 100%;
  padding: 0.3em 0.5em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  margin-top: 0.2em;
  box-sizing: border-box;
}
.hint {
  font-size: 0.8em;
  color: #78909c;
  margin: 0.2em 0;
}
.modal-error {
  font-size: 0.8em;
  color: #c62828;
  margin: 0.4em 0 0;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5em;
  margin-top: 1em;
}
.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 0.3em 0.8em;
  border-radius: 4px;
  border: 1px solid #cfd8dc;
  cursor: pointer;
  background: #fff;
}
.btn-primary {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-danger {
  background: #c62828;
  color: #fff;
  border-color: #c62828;
}
.icon-btn {
  background: transparent;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  padding: 0.2em 0.5em;
  cursor: pointer;
}
.icon-btn.danger:hover {
  color: #c62828;
  border-color: #c62828;
}
@media (prefers-color-scheme: dark) {
  .icon-btn {
    background: transparent;
    border-color: #455a64;
    color: #cfd8dc;
  }
  .icon-btn.danger:hover {
    color: #ff6659;
    border-color: #ff6659;
  }
  .dashboards-tabs-wrap .tab-item {
    background: #1e2a32;
    color: #cfd8dc;
    border-color: #455a64;
  }
  .tab-item:hover {
    background: #263238;
  }
  .tab-item.active {
    background: #1976d2;
    color: #fff;
    border-color: #1976d2;
  }
  .dashboard-content {
    background: #1e2a32;
    border-color: #455a64;
    color: #cfd8dc;
  }
  .error {
    background: #3e2723;
    color: #ffab91;
    border-color: #5d4037;
  }
  .modal-card,
  .modal-card input,
  .btn-secondary,
  .icon-btn {
    background: #1e2a32;
    color: #cfd8dc;
    border-color: #455a64;
  }
  .btn-danger {
    background: #b71c1c;
    border-color: #b71c1c;
  }
}
</style>
