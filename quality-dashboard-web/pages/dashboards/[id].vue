<template>
  <div class="dashboard-detail-page">
    <NuxtLink to="/dashboards" class="back-link">
      <i class="bi bi-arrow-left"></i> Back to dashboards
    </NuxtLink>

    <div v-if="loading" class="loading">Loading...</div>

    <div v-else-if="!aggregate" class="not-found">Dashboard not found.</div>

    <div v-else>
      <div class="dashboard-header">
        <h2>{{ aggregate.dashboard.name }}</h2>
        <div class="header-actions">
          <button
            v-if="authenticationStore.isAuthenticated"
            class="btn-secondary"
            @click="showEdit = true"
          >
            <i class="bi bi-pencil"></i> Edit
          </button>
          <button
            v-if="authenticationStore.isAuthenticated"
            class="btn-danger"
            @click="onDelete"
          >
            <i class="bi bi-trash"></i> Delete
          </button>
        </div>
      </div>

      <p class="levels-summary">
        Levels: <code>{{ levelsSummary }}</code>
      </p>

      <div v-if="aggregate.tree.length === 0" class="empty">
        No reports match this dashboard yet.
      </div>

      <DashboardNode
        v-for="(node, i) in aggregate.tree"
        :key="`${i}-${node.label}`"
        :node="node"
      />
    </div>

    <div v-if="showEdit && aggregate" class="modal">
      <div class="modal-card">
        <h3>Edit dashboard</h3>
        <label>Name</label>
        <input v-model="editName" />
        <label>Levels</label>
        <div v-for="(lvl, i) in editLevels" :key="i" class="level-row">
          <input v-model="lvl.tag" placeholder="tag" />
          <span>=</span>
          <input v-model="lvl.value" placeholder="(any value)" />
          <button class="icon-btn danger" @click="removeEditLevel(i)">
            <i class="bi bi-x-circle"></i>
          </button>
        </div>
        <button class="btn-secondary" @click="addEditLevel">
          <i class="bi bi-plus"></i> Add level
        </button>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showEdit = false">
            Cancel
          </button>
          <button class="btn-primary" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";
import type {
  DashboardAggregate,
  DashboardLevel,
} from "~~/stores/DashboardsStore";

definePageMeta({});

const route = useRoute();
const router = useRouter();
const dashboardsStore = DashboardsStore();
const authenticationStore = AuthenticationStore();
const applicationSettingsStore = ApplicationSetttingsStore();

const dashboardId = computed(() => String(route.params.id));

const loading = ref(true);
const aggregate = ref<DashboardAggregate | null>(null);
const showEdit = ref(false);
const editName = ref("");
const editLevels = ref<DashboardLevel[]>([]);

const levelsSummary = computed(() => {
  if (!aggregate.value) return "";
  return (
    aggregate.value.dashboard.levels
      .map((l) => (l.value ? `${l.tag}=${l.value}` : l.tag))
      .join(" › ") || "(none)"
  );
});

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
  await refresh();
});

async function refresh(): Promise<void> {
  loading.value = true;
  try {
    aggregate.value = await dashboardsStore.fetchAggregate(dashboardId.value);
    if (aggregate.value) {
      editName.value = aggregate.value.dashboard.name;
      editLevels.value = aggregate.value.dashboard.levels.map((l) => ({
        tag: l.tag,
        value: l.value || "",
      }));
    }
  } finally {
    loading.value = false;
  }
}

function addEditLevel(): void {
  editLevels.value.push({ tag: "", value: "" });
}

function removeEditLevel(i: number): void {
  editLevels.value.splice(i, 1);
}

async function saveEdit(): Promise<void> {
  if (!aggregate.value) return;
  const cleaned: DashboardLevel[] = editLevels.value
    .map((l) => ({
      tag: l.tag.trim(),
      value:
        l.value && String(l.value).trim() ? String(l.value).trim() : undefined,
    }))
    .filter((l) => l.tag);
  await dashboardsStore.update(
    aggregate.value.dashboard.id,
    editName.value.trim(),
    cleaned,
  );
  showEdit.value = false;
  await refresh();
}

async function onDelete(): Promise<void> {
  if (!aggregate.value) return;
  if (!confirm(`Delete dashboard "${aggregate.value.dashboard.name}"?`)) {
    return;
  }
  await dashboardsStore.remove(aggregate.value.dashboard.id);
  router.push("/dashboards");
}
</script>

<style scoped>
.dashboard-detail-page {
  padding: 0.5em 0.5em 2em;
}
.back-link {
  display: inline-block;
  margin-bottom: 0.6em;
  color: #607d8b;
  text-decoration: none;
}
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5em;
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
.not-found,
.empty {
  text-align: center;
  padding: 1.5em;
  color: #78909c;
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
  width: min(520px, 92vw);
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
}
@media (prefers-color-scheme: dark) {
  .modal-card,
  .modal-card input,
  .btn-secondary,
  .icon-btn {
    background: #1e2a32;
    color: #cfd8dc;
    border-color: #455a64;
  }
}
</style>
