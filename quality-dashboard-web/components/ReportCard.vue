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
      <span class="report-card-date">{{
        formatDate(report.dateCreated)
      }}</span>
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
</template>

<script setup lang="ts">
import type { Report } from "~~/stores/ReportsStore";

const props = defineProps<{
  report: Report;
  showActions?: boolean;
}>();

const emit = defineEmits<{
  edit: [report: Report];
  delete: [report: Report];
}>();

const router = useRouter();

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
  display: flex;
  flex-direction: column;
  gap: 0.15em;
  padding: 0.45em 0.6em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.report-card:hover {
  border-color: #90a4ae;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.report-card-header {
  display: flex;
  align-items: center;
}
.report-card-title {
  font-weight: 600;
  color: #0d47a1;
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.report-card-tags {
  display: flex;
  align-items: center;
  gap: 0.35em;
  flex-wrap: wrap;
  margin-top: 0.1em;
}
.report-card-tags .tag-chip {
  font-size: 0.68em;
  padding: 0.06em 0.35em;
}
.tag-chip {
  background: #e3f2fd;
  color: #1565c0;
  padding: 0.08em 0.4em;
  border-radius: 3px;
  font-size: 0.72em;
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 18ch;
  flex-shrink: 0;
}
.report-card-date {
  font-size: 0.72em;
  color: #78909c;
  white-space: nowrap;
}
.report-card-body {
  display: flex;
  align-items: center;
  gap: 0.5em;
  flex-wrap: wrap;
  padding-top: 0.15em;
  border-top: 1px solid #eceff1;
  margin-top: 0.1em;
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
  font-size: 0.7em;
  color: #90a4ae;
  white-space: nowrap;
}
.report-card-empty-text {
  font-size: 0.75em;
  color: #b0bec5;
  font-style: italic;
}
.report-card-actions {
  display: flex;
  gap: 0.3em;
  flex-shrink: 0;
  align-self: flex-end;
  margin-top: 0.1em;
  margin-left: auto;
}
.icon-btn {
  background: transparent;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  padding: 0.15em 0.4em;
  cursor: pointer;
  color: #455a64;
  font-size: 0.8em;
  line-height: 1;
}
.icon-btn.danger:hover {
  color: #c62828;
  border-color: #c62828;
}
@media (prefers-color-scheme: dark) {
  .report-card {
    background: #1e2a32;
    border-color: #455a64;
  }
  .report-card:hover {
    border-color: #607d8b;
  }
  .report-card-title {
    color: #82b1ff;
  }
  .tag-chip {
    background: #1a3a5c;
    color: #82b1ff;
  }
  .report-card-date {
    color: #90a4ae;
  }
  .report-card-body {
    border-top-color: #37474f;
  }
  .report-card-body-empty {
    border-top-color: transparent;
  }
  .report-card-latest-date {
    color: #546e7a;
  }
  .report-card-empty-text {
    color: #546e7a;
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
}
</style>
