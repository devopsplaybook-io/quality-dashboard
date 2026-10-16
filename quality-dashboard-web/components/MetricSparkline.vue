<template>
  <svg
    v-if="values.length >= 2"
    class="metric-sparkline"
    :class="toneClass"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    aria-hidden="true"
  >
    <polyline
      :points="polylinePoints"
      fill="none"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <circle :cx="lastPoint.x" :cy="lastPoint.y" r="2" class="spark-dot" />
  </svg>
</template>

<script setup lang="ts">
import { isImprovement, trendDirection, windowPastValue } from "~~/services/MetricTrend";

const props = defineProps<{
  /** Chronological values (oldest first). */
  values: number[];
  lowerIsBetter: boolean;
}>();

const width = 48;
const height = 18;
const pad = 2;

const minValue = computed(() => Math.min(...props.values));
const maxValue = computed(() => Math.max(...props.values));

const coordinates = computed(() => {
  const n = props.values.length;
  const span = maxValue.value - minValue.value;
  return props.values.map((v, i) => ({
    x:
      pad +
      (i * (width - 2 * pad)) / Math.max(1, n - 1),
    y:
      span === 0
        ? height / 2
        : pad + (1 - (v - minValue.value) / span) * (height - 2 * pad),
  }));
});

const polylinePoints = computed(() =>
  coordinates.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
);

const lastPoint = computed(
  () => coordinates.value[coordinates.value.length - 1],
);

const currentValue = computed(() => props.values[props.values.length - 1]);

const toneClass = computed(() => {
  const past = windowPastValue(props.values);
  if (past === null) {
    return "spark-flat";
  }
  const direction = trendDirection(props.currentValue, past, props.lowerIsBetter);
  if (direction === null) {
    return "spark-flat";
  }
  return isImprovement(props.currentValue, past, props.lowerIsBetter)
    ? "spark-good"
    : "spark-bad";
});
</script>

<style scoped>
.metric-sparkline {
  flex-shrink: 0;
  margin-left: 0.15em;
}
.spark-good polyline,
.spark-good .spark-dot {
  stroke: var(--color-success);
  fill: var(--color-success);
}
.spark-bad polyline,
.spark-bad .spark-dot {
  stroke: var(--color-danger);
  fill: var(--color-danger);
}
.spark-flat polyline,
.spark-flat .spark-dot {
  stroke: var(--color-text-muted);
  fill: var(--color-text-muted);
}
</style>
