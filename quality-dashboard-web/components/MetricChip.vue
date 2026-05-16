<template>
  <span class="metric-chip" :class="`metric-chip-${metric.type}`" :title="title">
    <span class="metric-chip-name">{{ metric.name }}</span>
    <span class="metric-chip-value">
      <template v-if="metric.type === 'percentage'">{{ formatPercentage(metric.value) }}</template>
      <template v-else-if="metric.type === 'duration'">{{ formatDuration(metric.value) }}</template>
      <template v-else-if="metric.type === 'boolean'">
        <i v-if="metric.value" class="bi bi-check-circle-fill"></i>
        <i v-else class="bi bi-x-circle-fill"></i>
      </template>
      <template v-else>{{ formatCount(metric.value) }}</template>
    </span>
  </span>
</template>

<script setup lang="ts">
import type { Metric } from "~~/stores/ReportsStore";

const props = defineProps<{
  metric: Metric;
  /** When true, the chip represents an aggregated value over multiple reports. */
  aggregated?: boolean;
}>();

const title = computed(() => {
  const a = props.aggregated ? " (aggregated)" : "";
  return `${props.metric.name}${a}`;
});

function formatCount(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-9) {
    return Math.round(v).toString();
  }
  return v.toFixed(2);
}

function formatPercentage(v: number): string {
  return `${v.toFixed(1)}%`;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} h`;
  return `${Math.round(ms / 86_400_000)} d`;
}
</script>

<style scoped>
.metric-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35em;
  padding: 0.15em 0.55em;
  margin: 0.15em 0.25em 0.15em 0;
  border-radius: 999px;
  font-size: 0.85em;
  border: 1px solid #cfd8dc;
  background-color: #f5f7fa;
  color: #263238;
}
.metric-chip-name {
  font-weight: 500;
  opacity: 0.85;
}
.metric-chip-value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.metric-chip-count {
  border-color: #b0bec5;
}
.metric-chip-percentage {
  border-color: #90caf9;
  background-color: #e3f2fd;
}
.metric-chip-duration {
  border-color: #ce93d8;
  background-color: #f3e5f5;
}
.metric-chip-boolean {
  border-color: #a5d6a7;
  background-color: #e8f5e9;
}
@media (prefers-color-scheme: dark) {
  .metric-chip {
    background-color: #2b3640;
    border-color: #455a64;
    color: #eceff1;
  }
  .metric-chip-percentage {
    background-color: #1e3a5f;
    border-color: #1e88e5;
  }
  .metric-chip-duration {
    background-color: #4a2e57;
    border-color: #ab47bc;
  }
  .metric-chip-boolean {
    background-color: #1f3d24;
    border-color: #66bb6a;
  }
}
</style>
