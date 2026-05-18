<template>
  <div class="report-card" @click="navigate">
    <div class="report-card-header">
      <span class="report-card-title">
        {{ report.displayName || report.key }}
      </span>
    </div>
    <div class="report-card-tags">
      <span v-for="tag in report.tags" :key="tag.tag" class="tag-chip">
        {{ tag.tag }}={{ tag.value }}
      </span>
      <span class="report-card-date">{{ formatDate(report.dateCreated) }}</span>
    </div>
    <div v-if="report.latestVersion" class="report-card-body">
      <span class="report-card-metrics">
        <span
          v-for="metric in report.latestVersion.metrics"
          :key="metric.name"
          class="metric-with-trend"
        >
          <MetricChip :metric="metric" />
          <LazyMetricTrend
            :report-key="report.key"
            :metric-name="metric.name"
            :current-value="metric.value"
          />
        </span>
      </span>
      <span
        class="report-card-latest-date"
        :title="'Latest scan: ' + formatDate(report.latestVersion.dateCreated)"
      >
        <i class="bi bi-clock"></i>
        {{ relativeDate(report.latestVersion.dateCreated) }}
      </span>
    </div>
    <div v-else class="report-card-body report-card-body-empty">
      <span class="report-card-empty-text">No versions yet</span>
    </div>
    <div v-if="showActions" class="report-card-actions">
      <button
        v-if="
          report.latestVersion?.hasFile && report.latestVersion?.fileEntrypoint
        "
        class="icon-btn"
        type="button"
        title="Download latest report file"
        @click.stop="downloadFile"
      >
        <i class="bi bi-download"></i>
      </button>
      <button
        v-if="
          report.latestVersion?.hasPreview ||
          (report.latestVersion?.hasFile &&
            report.latestVersion?.fileEntrypoint &&
            isTextFile)
        "
        class="icon-btn"
        type="button"
        :title="
          report.latestVersion?.hasPreview
            ? 'View formatted preview'
            : 'View report file'
        "
        @click.stop="showFileDialog = true"
      >
        <i class="bi bi-eye"></i>
      </button>
      <button class="icon-btn" type="button" title="Edit" @click.stop="onEdit">
        <i class="bi bi-pencil"></i>
      </button>
      <button
        class="icon-btn danger"
        type="button"
        title="Delete"
        @click.stop="onDelete"
      >
        <i class="bi bi-trash"></i>
      </button>
    </div>
  </div>

  <FileContentDialog
    :visible="showFileDialog"
    :file-url="fileUrl"
    :preview-url="previewUrl"
    :is-preview="!!report.latestVersion?.hasPreview"
    :download-url="fileDownloadUrl"
    :file-name="report.latestVersion?.fileEntrypoint || ''"
    @close="showFileDialog = false"
  />
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";
import type { Report } from "~~/stores/ReportsStore";
import Config from "~~/services/Config";
import { FileUtils } from "~~/services/FileUtils";

const props = defineProps<{
  report: Report;
  showActions?: boolean;
}>();

const emit = defineEmits<{
  edit: [report: Report];
  delete: [report: Report];
}>();

const router = useRouter();
const serverUrl = ref("");

onMounted(async () => {
  serverUrl.value = (await Config.get()).SERVER_URL;
});

const fileUrl = computed(() => {
  const lv = props.report.latestVersion;
  if (!lv || !lv.hasFile || !lv.fileEntrypoint) return "#";
  return `${serverUrl.value}/reports/${encodeURIComponent(props.report.key)}/versions/${lv.id}/file/${lv.fileEntrypoint}`;
});

const previewUrl = computed(() => {
  const lv = props.report.latestVersion;
  if (!lv) return "#";
  return `${serverUrl.value}/reports/${encodeURIComponent(props.report.key)}/versions/${lv.id}/preview`;
});

const fileDownloadUrl = computed(() => {
  if (fileUrl.value === "#") return "#";
  return `${fileUrl.value}?download=1`;
});

const isTextFile = computed(() => {
  const lv = props.report.latestVersion;
  return !!(
    lv?.fileEntrypoint &&
    (FileUtils.isTextExtension(lv.fileEntrypoint) || lv?.hasPreview)
  );
});

const showFileDialog = ref(false);

async function downloadFile(): Promise<void> {
  if (fileUrl.value === "#") return;
  try {
    const token = await AuthService.getToken();
    if (!token) {
      window.open(fileDownloadUrl.value, "_blank");
      return;
    }
    const response = await fetch(fileUrl.value + "?download=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = props.report.latestVersion?.fileEntrypoint || "report";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Download failed", err);
  }
}

function navigate(): void {
  router.push(`/reports/${encodeURIComponent(props.report.key)}`);
}

function onEdit(): void {
  emit("edit", props.report);
}

function onDelete(): void {
  emit("delete", props.report);
}

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 30000);
});

onBeforeUnmount(() => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
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
</script>

<style scoped>
.report-card {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-xs);
  padding: var(--space-md) var(--space-compact);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  cursor: pointer;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.report-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: 0 1px 4px var(--color-shadow-sm);
}
.report-card-header {
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
}
.report-card-title {
  font-weight: 600;
  color: var(--color-primary-dark);
  font-size: var(--font-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.report-card-tags {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
.tag-chip {
  background: var(--color-primary-light);
  color: var(--color-primary-text);
  padding: 0.08em var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 18ch;
  flex-shrink: 0;
}
.report-card-date {
  font-size: var(--font-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}
.report-card-body {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  padding-top: 0.15em;
  border-top: 1px solid var(--color-border-light);
}
.report-card-body-empty {
  border-top-color: transparent;
}
.report-card-metrics {
  display: flex;
  align-items: center;
  gap: 0.2em;
  flex-wrap: wrap;
  min-width: 0;
}
.metric-with-trend {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.report-card-latest-date {
  font-size: var(--font-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}
.report-card-empty-text {
  font-size: var(--font-sm);
  color: var(--color-text-placeholder);
  font-style: italic;
}
.report-card-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(28px, auto));
  gap: var(--space-xs);
  justify-content: end;
}

.report-card-actions button {
  margin-top: var(--space-base);
  margin-bottom: var(--space-sm);
}

@media (prefers-color-scheme: dark) {
  .report-card {
    background: var(--color-bg);
    border-color: var(--color-border);
  }
  .report-card:hover {
    border-color: var(--color-border-hover);
  }
  .report-card-title {
    color: var(--color-primary-hover);
  }
  .tag-chip {
    background: var(--color-primary-light);
    color: var(--color-primary-text);
  }
  .report-card-date {
    color: var(--color-text-muted);
  }
  .report-card-body {
    border-top-color: var(--color-border-light);
  }
  .report-card-body-empty {
    border-top-color: transparent;
  }
  .report-card-latest-date {
    color: var(--color-text-placeholder);
  }
  .report-card-empty-text {
    color: var(--color-text-placeholder);
  }
}
</style>
