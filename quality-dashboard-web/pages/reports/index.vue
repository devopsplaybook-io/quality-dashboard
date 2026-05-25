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
        authenticationStore.canConfigureReportTags && filteredReports.length > 0
      "
      class="reports-selection-bar"
    >
      <label class="select-all">
        <input
          type="checkbox"
          :checked="allVisibleSelected"
          :indeterminate.prop="someVisibleSelected && !allVisibleSelected"
          @change="toggleSelectAll"
        />
        <span v-if="selectedKeys.size === 0">Select all</span>
        <span v-else>{{ selectedKeys.size }} selected</span>
      </label>
      <span class="selection-spacer"></span>
      <button
        v-if="selectedKeys.size > 0"
        class="btn-secondary"
        type="button"
        @click="clearSelection"
      >
        <i class="bi bi-x-lg"></i> Clear
      </button>
      <button
        v-if="selectedKeys.size > 0"
        class="btn-primary"
        type="button"
        @click="openBulkTag"
      >
        <i class="bi bi-tag"></i> Set tag
      </button>
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
        <label
          v-if="authenticationStore.canConfigureReportTags"
          class="report-select"
          @click.stop
        >
          <input
            type="checkbox"
            :checked="selectedKeys.has(report.key)"
            @change="toggleSelection(report.key)"
          />
        </label>
        <ReportCard
          :report="report"
          :show-actions="authenticationStore.canConfigureReportTags"
          @edit="openEdit"
          @delete="onDelete"
        />
      </li>
    </ul>

    <div v-if="showBulkTag" class="modal">
      <div class="modal-card">
        <h3>Set tag on {{ selectedKeys.size }} report(s)</h3>
        <p class="hint">
          The tag will be added or updated on all selected reports. Existing
          other tags are preserved.
        </p>
        <div class="tag-row">
          <TagEditField
            v-model:tag="bulkTag.tag"
            v-model:value="bulkTag.value"
            :tag-suggestions="tagsStore.tagNames"
            :value-suggestions="tagsStore.valuesForTag(bulkTag.tag)"
            tag-placeholder="tag"
            value-placeholder="value"
          />
        </div>
        <div v-if="bulkError" class="reports-error">{{ bulkError }}</div>
        <div class="modal-actions">
          <button
            class="btn-secondary"
            :disabled="bulkSaving"
            @click="cancelBulkTag"
          >
            Cancel
          </button>
          <button
            class="btn-primary"
            :disabled="
              bulkSaving || !bulkTag.tag.trim() || !bulkTag.value.trim()
            "
            @click="applyBulkTag"
          >
            <span v-if="bulkSaving">
              <i class="bi bi-arrow-repeat spin"></i> Applying…
            </span>
            <span v-else>Apply</span>
          </button>
        </div>
      </div>
    </div>

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

const selectedKeys = ref<Set<string>>(new Set());
const showBulkTag = ref(false);
const bulkTag = ref<{ tag: string; value: string }>({ tag: "", value: "" });
const bulkSaving = ref(false);
const bulkError = ref<string | null>(null);

const filteredReports = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  let list = reportsStore.reports;
  if (q) {
    list = list.filter((r) => {
      if ((r.displayName || "").toLowerCase().includes(q)) return true;
      if (r.key.toLowerCase().includes(q)) return true;
      if (r.tags.some((t) => `${t.tag}=${t.value}`.toLowerCase().includes(q)))
        return true;
      return false;
    });
  }
  // Sort by latest version date, newest first
  return [...list].sort((a, b) => {
    const dateA = new Date(a.latestVersion?.dateCreated || a.dateCreated).getTime();
    const dateB = new Date(b.latestVersion?.dateCreated || b.dateCreated).getTime();
    return dateB - dateA;
  });
});

const allVisibleSelected = computed(() => {
  if (filteredReports.value.length === 0) return false;
  return filteredReports.value.every((r) => selectedKeys.value.has(r.key));
});

const someVisibleSelected = computed(() => {
  return filteredReports.value.some((r) => selectedKeys.value.has(r.key));
});

function toggleSelection(key: string): void {
  const next = new Set(selectedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selectedKeys.value = next;
}

function toggleSelectAll(): void {
  const next = new Set(selectedKeys.value);
  if (allVisibleSelected.value) {
    for (const r of filteredReports.value) next.delete(r.key);
  } else {
    for (const r of filteredReports.value) next.add(r.key);
  }
  selectedKeys.value = next;
}

function clearSelection(): void {
  selectedKeys.value = new Set();
}

function openBulkTag(): void {
  bulkTag.value = { tag: "", value: "" };
  bulkError.value = null;
  showBulkTag.value = true;
}

function cancelBulkTag(): void {
  if (bulkSaving.value) return;
  showBulkTag.value = false;
  bulkTag.value = { tag: "", value: "" };
  bulkError.value = null;
}

async function applyBulkTag(): Promise<void> {
  const tag = bulkTag.value.tag.trim();
  const value = bulkTag.value.value.trim();
  if (!tag || !value) return;
  bulkSaving.value = true;
  bulkError.value = null;
  try {
    const keys = Array.from(selectedKeys.value);
    await Promise.all(keys.map((k) => tagsStore.setTag(k, tag, value)));
    showBulkTag.value = false;
    bulkTag.value = { tag: "", value: "" };
    clearSelection();
    await refresh();
  } catch (err) {
    bulkError.value = (err as Error).message || "Failed to apply tag";
  } finally {
    bulkSaving.value = false;
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
  padding: var(--space-md) var(--space-md) var(--space-2xl);
}
.reports-toolbar {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--space-md);
  align-items: center;
  margin-bottom: var(--space-base);
}
.reports-selection-bar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-compact);
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
}
.select-all {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-base);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}
.selection-spacer {
  flex: 1;
}
.report-select {
  display: inline-flex;
  align-items: center;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
}
.report-select input {
  padding: 0;
  margin: 0;
}
@media (max-width: 480px) {
  .reports-loading {
    display: none;
  }
}
.reports-refresh {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-xs) var(--space-compact);
  cursor: pointer;
  color: var(--color-text-secondary);
}
.reports-refresh:disabled {
  cursor: wait;
  opacity: 0.6;
}
.reports-loading .spin {
  display: inline-block;
}
.reports-error {
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error-border);
  padding: var(--space-compact) var(--space-base);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-base);
}
.reports-empty {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-2xl) var(--space-loose);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}
.reports-empty-hint code {
  background-color: var(--color-bg-hover);
  padding: 0.1em var(--space-sm);
  border-radius: var(--radius-sm);
}
.reports-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.report-item {
  padding: var(--space-compact) var(--space-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-sm);
  background: var(--color-bg);
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.4em 0.6em;
  cursor: pointer;
}
.report-item :deep(.report-card) {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
}
.report-item:hover {
  border-color: var(--color-border-hover);
}
.tag-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}
.reports-loading,
.reports-search {
  height: 2.5rem;
  margin-bottom: 0;
}
@media (prefers-color-scheme: dark) {
  .reports-selection-bar {
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
  }
  .select-all {
    color: var(--color-text);
  }
  .reports-refresh {
    border-color: var(--color-border);
    color: var(--color-text);
  }
  .reports-error {
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border-color: var(--color-error-border);
  }
  .reports-empty {
    border-color: var(--color-border-light);
    color: var(--color-text-muted);
  }
  .reports-empty-hint code {
    background-color: var(--color-bg-secondary);
    color: var(--color-text);
  }
  .report-item {
    background: var(--color-bg);
    border-color: var(--color-border);
  }
  .report-item:hover {
    border-color: var(--color-border-hover);
  }
}
</style>
