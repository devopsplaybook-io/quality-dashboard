<template>
  <div class="page report-detail-page">
    <NuxtLink to="/reports" class="back-link">
      <i class="bi bi-arrow-left"></i> Back to reports
    </NuxtLink>

    <div v-if="loading" class="loading">Loading...</div>

    <div v-else-if="!report" class="not-found">Report not found.</div>

    <div v-else>
      <div class="report-header">
        <h2 v-if="!editingName">
          {{ report.displayName || report.key }}
          <button
            v-if="authenticationStore.isAuthenticated"
            class="icon-btn"
            title="Edit display name"
            @click="startEditName"
          >
            <i class="bi bi-pencil"></i>
          </button>
        </h2>
        <div v-else class="edit-name-row">
          <input v-model="newDisplayName" placeholder="Display name" />
          <button class="btn-primary" @click="saveDisplayName">Save</button>
          <button class="btn-secondary" @click="editingName = false">
            Cancel
          </button>
        </div>
        <p class="report-key">
          <code>{{ report.key }}</code>
        </p>
      </div>

      <section class="versions-section">
        <div class="versions-header">
          <h3>
            {{
              showHistory ? `Versions (${versions.length})` : "Latest Version"
            }}
          </h3>
          <button
            v-if="versions.length > 1"
            class="btn-secondary btn-history-toggle"
            @click="showHistory = !showHistory"
          >
            <i
              :class="showHistory ? 'bi bi-chevron-up' : 'bi bi-clock-history'"
            ></i>
            {{
              showHistory
                ? "Show latest only"
                : `Show history (${versions.length - 1} more)`
            }}
          </button>
        </div>
        <div v-if="versions.length === 0" class="empty">No versions yet.</div>
        <VersionCard
          v-for="v in displayVersions"
          :key="v.id"
          :version="v"
          :can-delete="authenticationStore.isAuthenticated"
          @delete="onDeleteVersion"
        />
      </section>

      <section class="tags-section">
        <h3>Tags</h3>
        <p class="tags-hint">
          Tags apply to all versions of this report (past and future).
        </p>
        <div class="tag-list">
          <TagEditField
            v-for="(t, i) in editableTags"
            :key="i"
            class="tag-row"
            v-model:tag="t.tag"
            v-model:value="t.value"
            :tag-suggestions="availableTagNames"
            :value-suggestions="getValuesForTag(t.tag)"
            tag-placeholder="tag"
            value-placeholder="value"
            :disabled="!authenticationStore.isAuthenticated"
            :removable="authenticationStore.isAuthenticated"
            @remove="removeTagRow(i)"
          />
        </div>
        <div v-if="authenticationStore.isAuthenticated" class="tag-actions">
          <button class="btn-secondary" @click="addTagRow">
            <i class="bi bi-plus"></i> Add tag
          </button>
          <button class="btn-primary" @click="saveTags">Save tags</button>
        </div>
      </section>

      <section v-if="authenticationStore.isAuthenticated" class="danger-zone">
        <button class="btn-danger" @click="onDeleteReport">
          <i class="bi bi-trash"></i> Delete report (and all its versions)
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";
import type { Report, ReportVersion } from "~~/stores/ReportsStore";

definePageMeta({});

const route = useRoute();
const router = useRouter();
const reportsStore = ReportsStore();
const tagsStore = TagsStore();
const authenticationStore = AuthenticationStore();
const applicationSettingsStore = ApplicationSetttingsStore();

const reportKey = computed(() => decodeURIComponent(String(route.params.key)));

const loading = ref(true);
const report = ref<Report | null>(null);
const versions = ref<ReportVersion[]>([]);
const editingName = ref(false);
const newDisplayName = ref("");
const editableTags = ref<{ tag: string; value: string }[]>([]);
const showHistory = ref(false);

const availableTagNames = computed(() => tagsStore.allTags.map((t) => t.tag));

const displayVersions = computed(() => {
  if (showHistory.value) return versions.value;
  return versions.value.length > 0 ? [versions.value[0]] : [];
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
  await Promise.all([tagsStore.fetchAll(), refresh()]);
});

async function refresh(): Promise<void> {
  loading.value = true;
  try {
    const [r, vs] = await Promise.all([
      reportsStore.fetchReport(reportKey.value),
      reportsStore.fetchVersionsForReport(reportKey.value),
    ]);
    report.value = r;
    versions.value = vs;
    editableTags.value = (r?.tags || []).map((t) => ({ ...t }));
  } finally {
    loading.value = false;
  }
}

function startEditName(): void {
  newDisplayName.value = report.value?.displayName || "";
  editingName.value = true;
}

async function saveDisplayName(): Promise<void> {
  if (!report.value) return;
  await reportsStore.setDisplayName(
    report.value.key,
    newDisplayName.value || null,
  );
  report.value.displayName = newDisplayName.value || null;
  editingName.value = false;
}

function addTagRow(): void {
  editableTags.value.push({ tag: "", value: "" });
}

function removeTagRow(i: number): void {
  editableTags.value.splice(i, 1);
}

async function saveTags(): Promise<void> {
  if (!report.value) return;
  const cleaned = editableTags.value
    .map((t) => ({ tag: t.tag.trim(), value: t.value.trim() }))
    .filter((t) => t.tag && t.value);
  await tagsStore.setTagsForReport(report.value.key, cleaned);
  report.value.tags = cleaned;
  editableTags.value = cleaned.map((t) => ({ ...t }));
}

async function onDeleteVersion(payload: {
  key: string;
  versionId: string;
}): Promise<void> {
  await reportsStore.removeVersion(payload.key, payload.versionId);
  versions.value = versions.value.filter((v) => v.id !== payload.versionId);
  if (versions.value.length === 0 && report.value) {
    // Report still exists logically (key entry), but no versions left.
  }
}

async function onDeleteReport(): Promise<void> {
  if (!report.value) return;
  if (
    !confirm(
      `Delete report "${report.value.displayName || report.value.key}" and all its versions?`,
    )
  ) {
    return;
  }
  await reportsStore.removeReport(report.value.key);
  router.push("/reports");
}
</script>

<style scoped>
.report-detail-page {
  padding: 0.5em 0.5em 2em;
}
.back-link {
  display: inline-block;
  margin-bottom: 0.6em;
  color: #607d8b;
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}
.loading,
.not-found {
  text-align: center;
  padding: 1.5em;
  color: #78909c;
}
.report-header {
  margin-bottom: 1em;
}
.report-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5em;
}
.report-key {
  font-size: 0.85em;
  color: #607d8b;
  margin: 0.2em 0 0;
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
.edit-name-row {
  display: flex;
  gap: 0.4em;
  align-items: center;
}
.edit-name-row input {
  padding: 0.3em 0.5em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
}
.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 0.3em 0.7em;
  border-radius: 4px;
  border: 1px solid #cfd8dc;
  cursor: pointer;
  background: #fff;
  color: #263238;
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
.tags-section,
.versions-section,
.danger-zone {
  margin-top: 1.5em;
}
.versions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em;
  margin-bottom: 0.6em;
}
.versions-header h3 {
  margin: 0;
}
.btn-history-toggle {
  font-size: 0.8em;
  white-space: nowrap;
}
.tags-hint {
  font-size: 0.85em;
  color: #78909c;
  margin: 0 0 0.6em;
}
.tag-list {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
  margin-bottom: 0.5em;
}
.tag-row {
  display: flex;
  align-items: center;
  gap: 0.3em;
}
.tag-actions {
  display: flex;
  gap: 0.4em;
}
.empty {
  color: #90a4ae;
  font-style: italic;
}
@media (prefers-color-scheme: dark) {
  .icon-btn,
  .btn-primary,
  .btn-secondary,
  .edit-name-row input {
    background: #1e2a32;
    color: #cfd8dc;
    border-color: #455a64;
  }
  .btn-primary {
    background: #1565c0;
    border-color: #1565c0;
    color: #fff;
  }
}
</style>
