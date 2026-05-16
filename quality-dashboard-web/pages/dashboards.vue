<template>
  <div class="dashboards-page">
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

    <div v-if="dashboardsStore.lastError" class="error">
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

    <ul v-else class="dashboard-list">
      <li v-for="d in dashboardsStore.dashboards" :key="d.id">
        <NuxtLink :to="`/dashboards/${d.id}`" class="dashboard-name">{{
          d.name
        }}</NuxtLink>
        <span class="levels-summary">
          {{ summarizeLevels(d.levels) }}
        </span>
        <div
          v-if="authenticationStore.isAuthenticated"
          class="dashboard-actions"
        >
          <button class="icon-btn" @click="openEdit(d)" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="icon-btn danger" @click="onDelete(d)" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </li>
    </ul>

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
import type { Dashboard, DashboardLevel } from "~~/stores/DashboardsStore";

const dashboardsStore = DashboardsStore();
const tagsStore = TagsStore();
const authenticationStore = AuthenticationStore();
const applicationSettingsStore = ApplicationSetttingsStore();
const router = useRouter();

const showCreate = ref(false);
const showEdit = ref(false);
const editingDashboard = ref<Dashboard | null>(null);
const editName = ref("");
const editLevels = ref<DashboardLevel[]>([]);

const availableTagNames = computed(() => tagsStore.allTags.map((t) => t.tag));

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
  await Promise.all([tagsStore.fetchAll(), dashboardsStore.fetchAll()]);
});

function summarizeLevels(levels: DashboardLevel[]): string {
  if (!levels || levels.length === 0) return "(no levels)";
  return levels
    .map((l) => (l.value ? `${l.tag}=${l.value}` : l.tag))
    .join(" › ");
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
  } else {
    const created = await dashboardsStore.create(name, cleaned);
    router.push(`/dashboards/${created.id}`);
    return;
  }
  cancelEdit();
  await dashboardsStore.fetchAll();
}

async function onDelete(d: Dashboard): Promise<void> {
  if (!confirm(`Delete dashboard "${d.name}"?`)) return;
  await dashboardsStore.remove(d.id);
  await dashboardsStore.fetchAll();
}

async function onDeleteFromModal(): Promise<void> {
  if (!editingDashboard.value) return;
  if (!confirm(`Delete dashboard "${editingDashboard.value.name}"?`)) return;
  await dashboardsStore.remove(editingDashboard.value.id);
  cancelEdit();
  await dashboardsStore.fetchAll();
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
.dashboard-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.dashboard-list li {
  padding: 0.5em 0.6em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  margin-bottom: 0.4em;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6em;
  background: #fff;
}
.dashboard-name {
  font-weight: 600;
  color: #0d47a1;
  text-decoration: none;
}
.dashboard-name:hover {
  text-decoration: underline;
}
.levels-summary {
  font-size: 0.8em;
  color: #607d8b;
  font-family: ui-monospace, monospace;
  flex: 1;
}
.dashboard-actions {
  display: flex;
  gap: 0.3em;
  flex-shrink: 0;
}
.empty,
.error {
  text-align: center;
  padding: 1em;
  color: #78909c;
}
.error {
  color: #bf360c;
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
  .dashboard-list li,
  .modal-card,
  .modal-card input,
  .btn-secondary,
  .icon-btn {
    background: #1e2a32;
    color: #cfd8dc;
    border-color: #455a64;
  }
  .dashboard-name {
    color: #82b1ff;
  }
  .btn-danger {
    background: #b71c1c;
    border-color: #b71c1c;
  }
}
</style>
