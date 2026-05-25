<template>
  <div class="page dashboards-page">
    <div v-if="dashboardsStore.lastError && !selectedId" class="error">
      {{ dashboardsStore.lastError }}
    </div>

    <div class="dashboard-tabs">
      <button
        v-for="d in dashboardsStore.dashboards"
        :key="d.id"
        class="dashboard-tab"
        :class="{ active: selectedId === d.id }"
        @click="selectDashboard(d.id)"
      >
        {{ d.name }}
      </button>
      <button
        v-if="authenticationStore.canConfigureDashboards"
        class="dashboard-tab"
        @click="openCreate"
      >
        <i class="bi bi-plus"></i> New
      </button>
    </div>

    <template v-if="dashboardsStore.dashboards.length > 0">
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
                v-if="authenticationStore.canConfigureDashboards"
                class="icon-btn"
                @click="openEdit(selectedData.dashboard)"
                title="Edit dashboard"
              >
                <i class="bi bi-pencil"></i>
              </button>
              <button
                v-if="authenticationStore.canConfigureDashboards"
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

          <div
            v-if="dashboardMetrics.length > 0"
            class="dashboard-metrics-summary"
          >
            <MetricChip
              v-for="m in dashboardMetrics"
              :key="`dashboard-${m.name}`"
              :metric="m"
              :aggregated="true"
            />
          </div>

          <div v-if="aggregatedTree.length === 0" class="empty">
            No reports match this dashboard yet.
          </div>

          <DashboardNode
            v-for="node in aggregatedTree"
            :key="node.path"
            :node="node"
            :default-expanded="false"
            :expand-bus="expandBus"
            :shown-metrics="selectedData.dashboard.shownMetrics"
          />
        </div>
      </div>
    </template>

    <div
      v-if="
        !dashboardsStore.isFetching && dashboardsStore.dashboards.length === 0
      "
      class="empty"
    >
      <div>No dashboards yet.</div>
    </div>

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

        <label>Node-level metrics to display</label>
        <p class="hint">
          One glob pattern per line. Only matching metric names are shown at
          each collapsed node. All metrics still appear in expanded report
          cards. Leave empty to show all. Wildcards: <code>*</code> (any
          sequence), <code>?</code> (single char).
        </p>
        <textarea
          v-model="editShownMetricsText"
          class="metrics-patterns-input"
          placeholder="kyverno.audit.*
trivy.*
coverage.*"
          rows="4"
        ></textarea>

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
import { filterMetrics } from "~~/services/MetricFilter";
import type {
  Dashboard,
  DashboardData,
  DashboardLevelNode,
} from "~~/stores/DashboardsStore";
import type { Metric } from "~~/stores/ReportsStore";
import type { ExpandBus } from "~~/components/DashboardNode.vue";

const dashboardsStore = DashboardsStore();
const tagsStore = TagsStore();
const reportsStore = ReportsStore();
const authenticationStore = AuthenticationStore();
const applicationSettingsStore = ApplicationSetttingsStore();
const router = useRouter();

const showCreate = ref(false);
const showEdit = ref(false);
const editingDashboard = ref<Dashboard | null>(null);
const editName = ref("");
const editRoot = ref<DashboardLevelNode[]>([]);
const editShownMetrics = ref<string[]>([]);

/** Textarea binding: join/split on newline. */
const editShownMetricsText = computed({
  get: () => editShownMetrics.value.join("\n"),
  set: (val: string) => {
    editShownMetrics.value = val
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  },
});

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

/** Aggregate metrics across ALL reports in the selected dashboard. */
const dashboardMetrics = computed<Metric[]>(() => {
  if (!selectedData.value) return [];
  const data = selectedData.value;
  const accum = new Map<string, { type: Metric["type"]; values: number[] }>();
  for (const report of data.reports) {
    for (const m of report.metrics) {
      let entry = accum.get(m.name);
      if (!entry) {
        entry = { type: m.type, values: [] };
        accum.set(m.name, entry);
      }
      entry.values.push(Number(m.value));
    }
  }
  const out: Metric[] = [];
  for (const [name, e] of accum.entries()) {
    let value = 0;
    if (e.type === "percentage" || e.type === "boolean") {
      value =
        e.values.reduce((a, b) => a + b, 0) / Math.max(1, e.values.length);
    } else {
      value = e.values.reduce((a, b) => a + b, 0);
    }
    out.push({ name, type: e.type, value });
  }
  return filterMetrics(out, data.dashboard.shownMetrics);
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
  editShownMetrics.value = [];
  showCreate.value = true;
}

function openEdit(d: Dashboard): void {
  editingDashboard.value = d;
  editName.value = d.name;
  editRoot.value = cloneRoot(d.root || []);
  editShownMetrics.value = d.shownMetrics ? [...d.shownMetrics] : [];
  showEdit.value = true;
}

function cancelEdit(): void {
  showCreate.value = false;
  showEdit.value = false;
  editingDashboard.value = null;
  editName.value = "";
  editRoot.value = [];
  editShownMetrics.value = [];
}

async function saveEdit(): Promise<void> {
  if (!canSave.value) return;
  const name = editName.value.trim();
  const root = editRoot.value;
  const shownMetrics =
    editShownMetrics.value.length > 0 ? editShownMetrics.value : undefined;
  if (editingDashboard.value) {
    await dashboardsStore.update(
      editingDashboard.value.id,
      name,
      root,
      shownMetrics,
    );
    await selectDashboard(editingDashboard.value.id);
  } else {
    const created = await dashboardsStore.create(name, root, shownMetrics);
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
  padding: var(--space-md) var(--space-md) var(--space-2xl);
}

/* Tab bar */
.dashboard-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-loose);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 0;
}
.dashboard-tabs::-webkit-scrollbar {
  display: none;
}
.dashboard-tab {
  padding: var(--space-md) var(--space-loose);
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background: transparent;
  cursor: pointer;
  font-size: var(--font-base);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  transition: all 0.15s;
  margin-bottom: -1px;
  white-space: nowrap;
  flex-shrink: 0;
}
.dashboard-tab:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}
.dashboard-tab.active {
  background: var(--color-bg);
  border-color: var(--color-border);
  color: var(--color-primary);
  font-weight: 600;
}
.dashboard-content {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-base);
  background: var(--color-bg);
}
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-bottom: 0;
}
.dashboard-header h3 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.header-actions {
  display: flex;
  gap: var(--space-sm);
}
.levels-summary {
  font-size: var(--font-base);
  color: var(--color-text-secondary);
  margin: 0.2em 0 var(--space-loose);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Dashboard-wide metric summary bar */
.dashboard-metrics-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2em;
  padding: var(--space-compact) var(--space-base);
  margin-bottom: var(--space-loose);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
}

.levels-summary code {
  font-family: ui-monospace, monospace;
  word-break: break-all;
  overflow-wrap: break-word;
}
.empty-inline {
  font-style: italic;
  color: var(--color-text-muted);
}
.loading,
.empty {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
}
.error {
  text-align: center;
  padding: var(--space-loose);
  color: var(--color-error);
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-base);
}

.modal-error {
  font-size: var(--font-md);
  color: var(--color-danger);
  margin: var(--space-sm) 0 0;
}

.metrics-patterns-input {
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, monospace;
  font-size: var(--font-base);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text);
  resize: vertical;
  margin-bottom: var(--space-md);
}

@media (prefers-color-scheme: dark) {
  .metrics-patterns-input {
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
    color: var(--color-text);
  }
  .dashboard-tabs {
    border-bottom-color: var(--color-border);
  }
  .dashboard-tab {
    color: var(--color-text-secondary);
  }
  .dashboard-tab:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
  }
  .dashboard-tab.active {
    background: var(--color-bg);
    border-color: var(--color-border);
    color: var(--color-primary);
  }
  .dashboard-content {
    background: var(--color-bg);
    border-color: var(--color-border);
    color: var(--color-text);
  }
  .error {
    background: var(--color-error-bg);
    color: var(--color-error);
    border-color: var(--color-error-border);
  }
}
</style>
