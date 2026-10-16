<template>
  <div class="metric-history-chart">
    <div class="metric-history-chart-header">
      <span class="metric-history-chart-name">{{ metricName }}</span>
      <span class="metric-history-chart-range">
        <span>min {{ formatMetricValue(metricType, minValue) }}</span>
        <span>max {{ formatMetricValue(metricType, maxValue) }}</span>
      </span>
    </div>
    <svg
      v-if="points.length >= 2"
      class="metric-history-chart-svg"
      :class="toneClass"
      :viewBox="`0 0 ${viewW} ${viewH}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="`History of ${metricName}`"
    >
      <polyline
        :points="polylinePoints"
        fill="none"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <circle
        v-for="(p, i) in coordinates"
        :key="i"
        :cx="p.x"
        :cy="p.y"
        :r="i === coordinates.length - 1 ? 4 : 2.5"
        class="chart-point"
      >
        <title>{{ tooltip(i) }}</title>
      </circle>
    </svg>
    <div v-else class="metric-history-chart-empty">Not enough data yet.</div>
  </div>
</template>

<script setup lang="ts">
import type { MetricType } from "~~/services/MetricTrend";
import { isImprovement, trendDirection, windowPastValue } from "~~/services/MetricTrend";
import { formatMetricValue } from "~~/services/MetricFormat";

const props = defineProps<{
  /** Chronological points (oldest first). */
  points: { date: string; value: number }[];
  metricName: string;
  metricType: MetricType;
}>();

const viewW = 600;
const viewH = 160;
const pad = 10;

const minValue = computed(() => Math.min(...props.points.map((p) => p.value)));
const maxValue = computed(() => Math.max(...props.points.map((p) => p.value)));

const coordinates = computed(() => {
  const n = props.points.length;
  const span = maxValue.value - minValue.value;
  return props.points.map((p, i) => ({
    x:
      pad +
      (i * (viewW - 2 * pad)) / Math.max(1, n - 1),
    y:
      span === 0
        ? viewH / 2
        : pad + (1 - (p.value - minValue.value) / span) * (viewH - 2 * pad),
  }));
});

const polylinePoints = computed(() =>
  coordinates.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
);

const lower = computed(() => lowerIsBetter(props.metricName, props.metricType));

const toneClass = computed(() => {
  const values = props.points.map((p) => p.value);
  const past = windowPastValue(values);
  if (past === null) {
    return "tone-flat";
  }
  const current = values[values.length - 1];
  if (trendDirection(current, past, lower.value) === null) {
    return "tone-flat";
  }
  return isImprovement(current, past, lower.value)
    ? "tone-good"
    : "tone-bad";
});

function tooltip(i: number): string {
  const p = props.points[i];
  return `${new Date(p.date).toLocaleString()} — ${formatMetricValue(props.metricType, p.value)}`;
}
</script>

<style scoped>
.metric-history-chart {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  min-width: 0;
}
.metric-history-chart-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-xs);
}
.metric-history-chart-name {
  font-weight: 600;
  font-family: ui-monospace, monospace;
  font-size: var(--font-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.metric-history-chart-range {
  display: flex;
  gap: var(--space-md);
  font-size: var(--font-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.metric-history-chart-svg {
  display: block;
  width: 100%;
  height: auto;
}
.metric-history-chart-svg .chart-point {
  fill: currentColor;
}
.tone-good {
  color: var(--color-success);
}
.tone-good polyline {
  stroke: var(--color-success);
}
.tone-bad {
  color: var(--color-danger);
}
.tone-bad polyline {
  stroke: var(--color-danger);
}
.tone-flat {
  color: var(--color-text-muted);
}
.tone-flat polyline {
  stroke: var(--color-text-muted);
}
.metric-history-chart-empty {
  color: var(--color-text-muted);
  font-style: italic;
  font-size: var(--font-sm);
}
</style>
