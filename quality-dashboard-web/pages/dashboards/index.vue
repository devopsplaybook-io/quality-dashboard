<template>
  <div class="page dashboards-page">
    <div class="page-header">
      <h2>Dashboards</h2>
      <button
        v-if="authenticationStore.isAuthenticated"
        class="btn-primary"
        @click="showCreate = true"
      >
        <i class="bi bi-plus"></i> New dashboard
      </button>
    </div>

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
      </div>

      <div class="dashboard-content">
        <div v-if="loadingAggregate" class="loading">Loading...</div>

        <div v-else-if="!selectedAggregate" class="empty">
          Select a dashboard to view its reports.
        </div>

        <div v-else-if="dashboardsStore.lastError" class="error">
          <i class="bi bi-exclamation-triangle-fill"></i>
          {{ dashboardsStore.lastError }}
        </div>

        <div v-else>
          <div class="dashboard-header">
            <h3>{{ selectedAggregate.dashboard.name }}</h3>
            <div class="header-actions">
              <button
                v-if="authenticationStore.isAuthenticated"
                class="icon-btn"
                @click="openEdit(selectedAggregate.dashboard)"
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
            Levels: <code>{{ levelsSummary }}</code>
          </p>

          <div v-if="selectedAggregate.tree.length === 0" class="empty">
            No reports match this dashboard yet.
          </div>

          <DashboardNode
            v-for="(node, i) in selectedAggregate.tree"
            :key="`${i}-${node.label}`"
            :node="node"
          />
        </div>
      </div>
    </template>

    <div v-if="showCreate || showEdit" class="modal">
      <div class="modal-card">
        <h3>{{ editingDashboard ? "Edit dashboard" : "New dashboard" }}</h3>
        <label>Name</label>
        <input v-model="editName" placeholder="My dashboard" />
        <label>Levels (top-down)</label>
        <p class="hint">
          Each level is a tag (group by all its values) or a tag=value (filter).
        </p>
        <div v-for="(lvl, i) in editLevels" :key="i" class="level-row">
          <AutocompleteInput
            v-model="lvl.tag"
            :suggestions="availableTagNames"
            placeholder="tag"
          />
          <span>=</span>
          <AutocompleteInput
            v-model="lvl.value"
            :suggestions="getValuesForTag(lvl.tag)"
            placeholder="(any value)"
          />
          <button class="icon-btn danger" @click="removeLevel(i)">
            <i class="bi bi-x-circle"></i>
          </button>
        </div>
        <button class="btn-secondary" @click="addLevel">
          <i class="bi bi-plus"></i> Add level
        </button>
        <div class="modal-actions">
          <button class="btn-secondary" @click="cancelEdit">Cancel</button>
          <button
            v-if="editingDashboard"
            class="btn-danger"
            @click="onDeleteFromModal"
          >
            <i class="bi bi-trash"></i> Delete
          </button>
          <button class="btn-primary" @click="saveEdit">
            {{ editingDashboard ? "Save" : "Create" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";
import type {
  Dashboard,
  DashboardAggregate,
  DashboardLevel,
} from "~~/stores/DashboardsStore";

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
const editLevels = ref<DashboardLevel[]>([]);

const selectedId = ref<string | null>(null);
const selectedAggregate = ref<DashboardAggregate | null>(null);
const loadingAggregate = ref(false);

const availableTagNames = computed(() => tagsStore.allTags.map((t) => t.tag));

const levelsSummary = computed(() => {
  if (!selectedAggregate.value) return "";
  return (
    selectedAggregate.value.dashboard.levels
      .map((l) => (l.value ? `${l.tag}=${l.value}` : l.tag))
      .join(" › ") || "(none)"
  );
});

function getValuesForTag(tagName: string): string[] {
  const tagAgg = tagsStore.allTags.find((t) => t.tag === tagName);
  return tagAgg ? tagAgg.values : [];
}

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
  if (dashboardsStore.dashboards.length > 0) {
    selectDashboard(dashboardsStore.dashboards[0].id);
  }
});

async function selectDashboard(id: string): Promise<void> {
  selectedId.value = id;
  loadingAggregate.value = true;
  try {
    selectedAggregate.value = await dashboardsStore.fetchAggregate(id);
  } finally {
    loadingAggregate.value = false;
  }
  if (selectedAggregate.value) {
    editName.value = selectedAggregate.value.dashboard.name;
    editLevels.value = selectedAggregate.value.dashboard.levels.map((l) => ({
      tag: l.tag,
      value: l.value || "",
    }));
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

function addLevel(): void {
  editLevels.value.push({ tag: "", value: "" });
}

function removeLevel(i: number): void {
  editLevels.value.splice(i, 1);
}

function openEdit(d: Dashboard): void {
  editingDashboard.value = d;
  showEdit.value = true;
  editName.value = d.name;
  editLevels.value = d.levels.map((l) => ({
    tag: l.tag,
    value: l.value || "",
  }));
}

function cancelEdit(): void {
  showCreate.value = false;
  showEdit.value = false;
  editingDashboard.value = null;
  editName.value = "";
  editLevels.value = [];
}

async function saveEdit(): Promise<void> {
  const name = editName.value.trim();
  if (!name) return;
  const cleaned: DashboardLevel[] = editLevels.value
    .map((l) => ({
      tag: l.tag.trim(),
      value: l.value && l.value.trim() ? l.value.trim() : undefined,
    }))
    .filter((l) => l.tag);

  if (editingDashboard.value) {
    await dashboardsStore.update(editingDashboard.value.id, name, cleaned);
    await selectDashboard(editingDashboard.value.id);
  } else {
    const created = await dashboardsStore.create(name, cleaned);
    selectedId.value = created.id;
    selectedAggregate.value = {
      dashboard: created,
      tree: [],
    };
  }
  cancelEdit();
  await dashboardsStore.fetchAll();
}

async function deleteSelected(): Promise<void> {
  if (!selectedAggregate.value) return;
  if (!confirm(`Delete dashboard "${selectedAggregate.value.dashboard.name}"?`))
    return;
  const deletedId = selectedAggregate.value.dashboard.id;
  await dashboardsStore.remove(deletedId);
  selectedAggregate.value = null;
  selectedId.value = null;
  if (dashboardsStore.dashboards.length > 0) {
    selectDashboard(dashboardsStore.dashboards[0].id);
  }
}

async function onDelete(d: Dashboard): Promise<void> {
  if (!confirm(`Delete dashboard "${d.name}"?`)) return;
  await dashboardsStore.remove(d.id);
  if (selectedId.value === d.id) {
    selectedAggregate.value = null;
    selectedId.value = null;
    if (dashboardsStore.dashboards.length > 0) {
      selectDashboard(dashboardsStore.dashboards[0].id);
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
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8em;
}
.dashboards-tabs-wrap {
  display: flex;
  align-items: center;
  gap: 0.2em;
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
  width: min(500px, 92vw);
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
.level-row {
  display: flex;
  align-items: center;
  gap: 0.3em;
  margin-bottom: 0.3em;
}
.level-row input {
  flex: 1;
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
