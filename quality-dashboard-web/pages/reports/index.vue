<template>
  <div class="page reports-page">
    <div class="reports-toolbar">
      <input
        v-model="searchQuery"
        type="search"
        name="search"
        aria-label="Search"
        placeholder="Filter by name, key, or tag…"
        class="reports-search"
      />
      <span v-if="reportsStore.isFetching" class="reports-loading">
        <i class="bi bi-arrow-repeat spin"></i> Loading...
      </span>
      <button
        class="reports-refresh"
        :disabled="reportsStore.isFetching"
        title="Refresh"
        @click="refresh"
      >
        <i class="bi bi-arrow-clockwise"></i>
      </button>
    </div>

    <div v-if="reportsStore.lastError" class="reports-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      {{ reportsStore.lastError }}
    </div>

    <div
      v-if="
        !reportsStore.isFetching &&
        filteredReports.length === 0 &&
        reportsStore.reports.length > 0
      "
      class="reports-empty"
    >
      <p>No reports match your filter.</p>
    </div>

    <div
      v-if="!reportsStore.isFetching && reportsStore.reports.length === 0"
      class="reports-empty"
    >
      <p>No reports yet.</p>
      <p class="reports-empty-hint">
        Upload a report via <code>POST /api/reports</code> with a multipart
        payload <code>meta = { key, processor, displayName? }</code>.
      </p>
    </div>

    <ul v-if="filteredReports.length > 0" class="reports-list">
      <li
        v-for="report in filteredReports"
        :key="report.key"
        class="report-item"
      >
        <ReportCard
          :report="report"
          :show-actions="authenticationStore.isAuthenticated"
          @edit="openEdit"
          @delete="onDelete"
        />
      </li>
    </ul>

    <div v-if="showEdit" class="modal">
      <div class="modal-card">
        <h3>Edit report</h3>
        <label>Display name</label>
        <input v-model="editDisplayName" placeholder="Display name" />
        <label>Tags</label>
        <p class="hint">Tags apply to all versions of this report.</p>
        <div v-for="(t, i) in editTags" :key="i" class="tag-row">
          <TagEditField
            v-model:tag="t.tag"
            v-model:value="t.value"
            :tag-suggestions="tagsStore.tagNames"
            :value-suggestions="tagsStore.valuesForTag(t.tag)"
            tag-placeholder="tag"
            value-placeholder="value"
            removable
            @remove="removeEditTag(i)"
          />
        </div>
        <button class="btn-secondary" @click="addEditTag">
          <i class="bi bi-plus"></i> Add tag
        </button>
        <div class="modal-actions">
          <button class="btn-secondary" @click="cancelEdit">Cancel</button>
          <button class="btn-primary" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";
import type { Report } from "~~/stores/ReportsStore";

const reportsStore = ReportsStore();
const tagsStore = TagsStore();
const authenticationStore = AuthenticationStore();
const applicationSettingsStore = ApplicationSetttingsStore();

const showEdit = ref(false);
const editingReport = ref<Report | null>(null);
const editDisplayName = ref("");
const editTags = ref<{ tag: string; value: string }[]>([]);

const searchQuery = ref("");

const filteredReports = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return reportsStore.reports;
  return reportsStore.reports.filter((r) => {
    if ((r.displayName || "").toLowerCase().includes(q)) return true;
    if (r.key.toLowerCase().includes(q)) return true;
    if (r.tags.some((t) => `${t.tag}=${t.value}`.toLowerCase().includes(q)))
      return true;
    return false;
  });
});

onMounted(async () => {
  await applicationSettingsStore.refresh();
  const isAuth = await AuthService.isAuthenticated();
  if (!isAuth) {
    if (!applicationSettingsStore.isInitialized) {
      useRouter().push({ path: "/users/initialize" });
      return;
    }
    if (!applicationSettingsStore.isDashboardPublic) {
      useRouter().push({ path: "/users/login" });
      return;
    }
  }
  await Promise.all([tagsStore.fetchAll(), reportsStore.fetchReports()]);
});

onBeforeUnmount(() => {});

async function refresh(): Promise<void> {
  await Promise.all([tagsStore.fetchAll(), reportsStore.fetchReports()]);
}

function openEdit(report: Report): void {
  editingReport.value = report;
  showEdit.value = true;
  editDisplayName.value = report.displayName || "";
  editTags.value = report.tags.map((t) => ({ ...t }));
}

function addEditTag(): void {
  editTags.value.push({ tag: "", value: "" });
}

function removeEditTag(i: number): void {
  editTags.value.splice(i, 1);
}

function cancelEdit(): void {
  showEdit.value = false;
  editingReport.value = null;
  editDisplayName.value = "";
  editTags.value = [];
}

async function saveEdit(): Promise<void> {
  if (!editingReport.value) return;
  const name = editDisplayName.value.trim() || null;
  const cleaned = editTags.value
    .map((t) => ({ tag: t.tag.trim(), value: t.value.trim() }))
    .filter((t) => t.tag && t.value);

  await Promise.all([
    reportsStore.setDisplayName(editingReport.value.key, name),
    tagsStore.setTagsForReport(editingReport.value.key, cleaned),
  ]);
  cancelEdit();
  await refresh();
}

async function onDelete(report: Report): Promise<void> {
  if (
    !confirm(
      `Delete report "${report.displayName || report.key}" and all its versions?`,
    )
  ) {
    return;
  }
  await reportsStore.removeReport(report.key);
  await refresh();
}
</script>

<style scoped>
.reports-page {
  padding: 0.5em 0.5em 2em;
}
.reports-toolbar {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.5em;
  align-items: center;
  margin-bottom: 0.8em;
}

@media (max-width: 480px) {
  .reports-loading {
    display: none;
  }
}
.reports-refresh {
  background: transparent;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  padding: 0.3em 0.6em;
  cursor: pointer;
  color: #455a64;
}
.reports-refresh:disabled {
  cursor: wait;
  opacity: 0.6;
}
.reports-loading .spin {
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.reports-error {
  background-color: #fff3e0;
  color: #bf360c;
  border: 1px solid #ffccbc;
  padding: 0.6em 0.8em;
  border-radius: 4px;
  margin-bottom: 0.8em;
}
.reports-empty {
  text-align: center;
  color: #78909c;
  padding: 2em 1em;
  border: 1px dashed #cfd8dc;
  border-radius: 6px;
}
.reports-empty-hint code {
  background-color: #eceff1;
  padding: 0.1em 0.4em;
  border-radius: 3px;
}
.reports-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.report-item {
  padding: 0.6em 0.8em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  margin-bottom: 0.4em;
  background: #fff;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em 0.6em;
  cursor: pointer;
}
.report-item:hover {
  border-color: #90a4ae;
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
  max-height: 90vh;
  overflow-y: auto;
}
.modal-card h3 {
  margin: 0 0 0.5em;
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
.tag-row {
  display: flex;
  align-items: center;
  gap: 0.3em;
  margin-bottom: 0.3em;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5em;
  margin-top: 1em;
}
.btn-primary,
.btn-secondary {
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
@media (prefers-color-scheme: dark) {
  .reports-refresh {
    border-color: #455a64;
    color: #cfd8dc;
  }
  .reports-error {
    background-color: #3e2723;
    color: #ffab91;
    border-color: #5d4037;
  }
  .reports-empty {
    border-color: #37474f;
    color: #90a4ae;
  }
  .reports-empty-hint code {
    background-color: #263238;
    color: #cfd8dc;
  }
  .report-item {
    background: #1e2a32;
    border-color: #455a64;
  }
  .report-item:hover {
    border-color: #607d8b;
  }
  .modal-card {
    background: #1e2a32;
    color: #cfd8dc;
  }
  .modal-card input {
    background: #263238;
    color: #cfd8dc;
    border-color: #455a64;
  }
  .btn-secondary {
    background: #1e2a32;
    color: #cfd8dc;
    border-color: #455a64;
  }
}
</style>
