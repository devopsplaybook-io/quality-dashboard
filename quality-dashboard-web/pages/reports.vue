<template>
  <div class="reports-page">
    <div class="reports-header">
      <h2>Reports</h2>
      <div class="reports-actions">
        <span v-if="reportsStore.isFetching" class="reports-loading">
          <i class="bi bi-arrow-repeat spin"></i> Loading...
        </span>
        <span v-else-if="reportsStore.lastFetched" class="reports-fetched">
          Updated {{ relativeFetched }}
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
    </div>

    <div v-if="reportsStore.lastError" class="reports-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      {{ reportsStore.lastError }}
    </div>

    <div class="reports-filter">
      <i class="bi bi-search"></i>
      <input
        v-model="searchQuery"
        type="search"
        class="reports-filter-input"
        placeholder="Filter by name, key, or tag…"
      />
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
        <NuxtLink
          :to="`/reports/${encodeURIComponent(report.key)}`"
          class="report-key"
        >
          {{ report.displayName || report.key }}
        </NuxtLink>
        <span class="report-meta">
          <span v-for="tag in report.tags" :key="tag.tag" class="tag-chip">
            {{ tag.tag }}={{ tag.value }}
          </span>
          <span class="report-date">{{ formatDate(report.dateCreated) }}</span>
        </span>
        <div v-if="report.latestVersion" class="report-latest">
          <span class="latest-metrics">
            <span
              v-for="metric in report.latestVersion.metrics"
              :key="metric.name"
              class="metric-chip"
              :class="metricClass(metric)"
              :title="metric.name"
            >
              {{ metricLabel(metric) }}
            </span>
          </span>
          <span
            class="latest-date"
            :title="
              'Latest scan: ' + formatDate(report.latestVersion.dateCreated)
            "
          >
            <i class="bi bi-clock"></i>
            {{ relativeDate(report.latestVersion.dateCreated) }}
          </span>
        </div>
        <div v-else class="report-latest report-latest-empty">
          <span class="latest-empty">No versions yet</span>
        </div>
        <div v-if="authenticationStore.isAuthenticated" class="report-actions">
          <button class="icon-btn" @click="openEdit(report)" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button
            class="icon-btn danger"
            @click="onDelete(report)"
            title="Delete"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
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
          <AutocompleteInput
            v-model="t.tag"
            :suggestions="availableTagNames"
            placeholder="tag"
          />
          <span>=</span>
          <AutocompleteInput
            v-model="t.value"
            :suggestions="getValuesForTag(t.tag)"
            placeholder="value"
          />
          <button class="icon-btn danger" @click="removeEditTag(i)">
            <i class="bi bi-x-circle"></i>
          </button>
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
import type { Metric, Report } from "~~/stores/ReportsStore";

const reportsStore = ReportsStore();
const tagsStore = TagsStore();
const authenticationStore = AuthenticationStore();
const applicationSettingsStore = ApplicationSetttingsStore();

const now = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | null = null;

const showEdit = ref(false);
const editingReport = ref<Report | null>(null);
const editDisplayName = ref("");
const editTags = ref<{ tag: string; value: string }[]>([]);

const availableTagNames = computed(() => tagsStore.allTags.map((t) => t.tag));

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

function getValuesForTag(tagName: string): string[] {
  const tagAgg = tagsStore.allTags.find((t) => t.tag === tagName);
  return tagAgg ? tagAgg.values : [];
}

const relativeFetched = computed(() => {
  if (!reportsStore.lastFetched) return "";
  const elapsed = now.value - reportsStore.lastFetched;
  const sec = Math.floor(elapsed / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ago`;
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

function relativeDate(iso: string): string {
  const elapsed = now.value - new Date(iso).getTime();
  const sec = Math.floor(elapsed / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function metricLabel(metric: Metric): string {
  switch (metric.type) {
    case "percentage":
      return `${metric.value}%`;
    case "duration":
      if (metric.value >= 60) {
        return `${(metric.value / 60).toFixed(1)}m`;
      }
      return `${metric.value}s`;
    case "boolean":
      return metric.value ? "✓" : "✗";
    default:
      return String(metric.value);
  }
}

function metricClass(metric: Metric): string {
  switch (metric.type) {
    case "boolean":
      return metric.value ? "metric-good" : "metric-bad";
    case "percentage":
      if (metric.value >= 80) return "metric-good";
      if (metric.value >= 50) return "metric-warn";
      return "metric-bad";
    default:
      return "";
  }
}

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
  nowTimer = setInterval(() => {
    now.value = Date.now();
  }, 30000);
});

onBeforeUnmount(() => {
  if (nowTimer !== null) {
    clearInterval(nowTimer);
    nowTimer = null;
  }
});

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
.reports-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.8em;
  flex-wrap: wrap;
  gap: 0.5em;
}
.reports-header h2 {
  margin: 0;
}
.reports-actions {
  display: flex;
  align-items: center;
  gap: 0.6em;
  font-size: 0.85em;
  color: #607d8b;
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
.reports-filter {
  display: flex;
  align-items: center;
  gap: 0.4em;
  margin-bottom: 0.6em;
  padding: 0.3em 0.5em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  background: #fff;
  color: #90a4ae;
}
.reports-filter-input {
  border: none;
  background: transparent;
  padding: 0.2em 0;
  outline: none;
  flex: 1;
  font-size: 0.85em;
  color: #455a64;
}
.reports-filter-input::placeholder {
  color: #b0bec5;
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
}
.report-key {
  font-weight: 600;
  color: #0d47a1;
  text-decoration: none;
}
.report-key:hover {
  text-decoration: underline;
}
.report-meta {
  display: flex;
  align-items: center;
  gap: 0.5em;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}
.tag-chip {
  background: #e3f2fd;
  color: #1565c0;
  padding: 0.15em 0.5em;
  border-radius: 3px;
  font-size: 0.8em;
  font-family: ui-monospace, monospace;
}
.report-date {
  font-size: 0.8em;
  color: #78909c;
}
.report-latest {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding-top: 0.3em;
  border-top: 1px solid #eceff1;
  margin-top: 0.1em;
}
.report-latest-empty {
  border-top-color: transparent;
}
.latest-metrics {
  display: flex;
  align-items: center;
  gap: 0.3em;
  flex-wrap: wrap;
}
.metric-chip {
  font-size: 0.75em;
  padding: 0.1em 0.4em;
  border-radius: 3px;
  background: #eceff1;
  color: #455a64;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
}
.metric-good {
  background: #e8f5e9;
  color: #2e7d32;
}
.metric-warn {
  background: #fff8e1;
  color: #f57f17;
}
.metric-bad {
  background: #ffebee;
  color: #c62828;
}
.latest-date {
  font-size: 0.75em;
  color: #90a4ae;
  white-space: nowrap;
}
.latest-empty {
  font-size: 0.75em;
  color: #b0bec5;
  font-style: italic;
}
.report-actions {
  display: flex;
  gap: 0.3em;
  flex-shrink: 0;
}
.icon-btn {
  background: transparent;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  padding: 0.2em 0.5em;
  cursor: pointer;
  color: #455a64;
}
.icon-btn.danger:hover {
  color: #c62828;
  border-color: #c62828;
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
  .reports-filter {
    background: #1e2a32;
    border-color: #455a64;
    color: #78909c;
  }
  .reports-filter-input {
    color: #cfd8dc;
  }
  .reports-filter-input::placeholder {
    color: #546e7a;
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
  .report-latest {
    border-top-color: #37474f;
  }
  .metric-chip {
    background: #37474f;
    color: #cfd8dc;
  }
  .metric-good {
    background: #1b5e20;
    color: #a5d6a7;
  }
  .metric-warn {
    background: #e65100;
    color: #ffe0b2;
  }
  .metric-bad {
    background: #b71c1c;
    color: #ef9a9a;
  }
  .latest-empty {
    color: #546e7a;
  }
  .report-key {
    color: #82b1ff;
  }
  .tag-chip {
    background: #1a3a5c;
    color: #82b1ff;
  }
  .icon-btn {
    background: transparent;
    border-color: #455a64;
    color: #cfd8dc;
  }
  .icon-btn.danger:hover {
    color: #ff6659;
    border-color: #ff6659;
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
