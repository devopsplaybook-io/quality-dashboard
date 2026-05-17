<template>
  <div class="version-card">
    <div class="version-card-header">
      <div class="version-card-title">
        <NuxtLink :to="`/reports/${encodeURIComponent(version.reportKey)}`">
          {{ version.reportDisplayName || version.reportKey }}
        </NuxtLink>
        <span class="version-card-processor">{{ version.processor }}</span>
      </div>
      <div class="version-card-actions">
        <a
          v-if="version.hasFile && version.fileEntrypoint"
          class="version-card-link"
          :href="fileUrl"
          target="_blank"
          rel="noopener"
          title="Open report file"
        >
          <i class="bi bi-box-arrow-up-right"></i>
        </a>
        <button
          v-if="canDelete"
          class="version-card-delete"
          title="Delete this version"
          @click="onDelete"
        >
          <i class="bi bi-trash-fill"></i>
        </button>
      </div>
    </div>
    <div
      v-if="version.tags && version.tags.length > 0"
      class="version-card-tags"
    >
      <span
        v-for="t in version.tags"
        :key="`${version.id}-${t.tag}`"
        class="version-card-tag"
        :title="`${t.tag}=${t.value}`"
      >
        {{ t.tag }}=<strong>{{ t.value }}</strong>
      </span>
    </div>
    <div class="version-card-metrics">
      <MetricChip
        v-for="m in version.metrics"
        :key="`${version.id}-${m.name}`"
        :metric="m"
      />
      <span v-if="version.metrics.length === 0" class="version-card-empty">
        No metrics
      </span>
    </div>
    <div class="version-card-footer">
      <span>{{ relativeDate }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportVersion } from "~~/stores/ReportsStore";
import Config from "~~/services/Config";

const props = defineProps<{ version: ReportVersion; canDelete?: boolean }>();
const emit = defineEmits<{
  (e: "delete", payload: { key: string; versionId: string }): void;
}>();

const serverUrl = ref("");
onMounted(async () => {
  serverUrl.value = (await Config.get()).SERVER_URL;
});

const fileUrl = computed(() => {
  if (!props.version.fileEntrypoint) return "#";
  return `${serverUrl.value}/reports/${encodeURIComponent(props.version.reportKey)}/versions/${props.version.id}/file/${props.version.fileEntrypoint}`;
});

const relativeDate = computed(() =>
  formatRelative(new Date(props.version.dateCreated)),
);

function onDelete(): void {
  if (
    confirm(
      `Delete this version of "${props.version.reportDisplayName || props.version.reportKey}"?`,
    )
  ) {
    emit("delete", {
      key: props.version.reportKey,
      versionId: props.version.id,
    });
  }
}

function formatRelative(date: Date): string {
  const elapsed = Date.now() - date.getTime();
  const sec = elapsed / 1000;
  if (sec < 60) return `${Math.round(sec)} sec ago`;
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  if (sec < 86400 * 30) return `${Math.round(sec / 86400)} d ago`;
  if (sec < 86400 * 365) return `${Math.round(sec / (86400 * 30))} mo ago`;
  return `${Math.round(sec / (86400 * 365))} y ago`;
}
</script>

<style scoped>
.version-card {
  border: 1px solid #cfd8dc;
  border-radius: 6px;
  padding: 0.6em 0.8em;
  background-color: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  margin-bottom: 0.6em;
}
.version-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5em;
}
.version-card-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.version-card-title a {
  font-weight: 600;
  color: #0d47a1;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: block;
}
.version-card-processor {
  font-size: 0.75em;
  color: #607d8b;
}
.version-card-actions {
  display: flex;
  gap: 0.4em;
  flex-shrink: 0;
}
.version-card-link,
.version-card-delete {
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 1em;
  color: #455a64;
}
.version-card-delete:hover {
  color: #c62828;
}
.version-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em;
}
.version-card-tag {
  font-size: 0.75em;
  background-color: #eceff1;
  color: #455a64;
  padding: 0.1em 0.45em;
  border-radius: 3px;
}
.version-card-metrics {
  display: flex;
  flex-wrap: wrap;
}
.version-card-empty {
  font-size: 0.85em;
  color: #90a4ae;
  font-style: italic;
}
.version-card-footer {
  font-size: 0.75em;
  color: #78909c;
  text-align: right;
}
@media (prefers-color-scheme: dark) {
  .version-card {
    background-color: #1e2a32;
    border-color: #37474f;
  }
  .version-card-title a {
    color: #82b1ff;
  }
  .version-card-tag {
    background-color: #263238;
    color: #cfd8dc;
  }
}
</style>
