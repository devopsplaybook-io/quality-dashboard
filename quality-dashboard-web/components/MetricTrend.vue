<template>
  <span
    v-if="direction"
    class="trend"
    :class="improved ? 'trend-good' : 'trend-bad'"
    :title="title"
  >
    <i :class="direction === 'up' ? 'bi bi-arrow-up-short' : 'bi bi-arrow-down-short'"></i>
  </span>
</template>

<script setup lang="ts">
import { isImprovement, trendDirection } from "~~/services/MetricTrend";

const props = defineProps<{
  currentValue: number;
  /** Value to compare against (e.g. TREND_WINDOW versions back), or null when unknown. */
  pastValue: number | null;
  lowerIsBetter: boolean;
}>();

const direction = computed(() =>
  props.pastValue === null
    ? null
    : trendDirection(props.currentValue, props.pastValue, props.lowerIsBetter),
);

const improved = computed(() =>
  props.pastValue === null
    ? false
    : isImprovement(props.currentValue, props.pastValue, props.lowerIsBetter),
);

const title = computed(() =>
  direction.value === "up"
    ? improved.value
      ? "Increased (improvement)"
      : "Increased (regression)"
    : improved.value
      ? "Decreased (improvement)"
      : "Decreased (regression)",
);
</script>

<style scoped>
.trend {
  display: inline-flex;
  align-items: center;
  font-size: 1em;
  line-height: 1;
  margin-left: 0.1em;
  vertical-align: middle;
  opacity: 0.8;
}
.trend i {
  font-size: 1.1em;
}
.trend-good {
  color: var(--color-success);
}
.trend-bad {
  color: var(--color-danger);
}
@media (prefers-color-scheme: dark) {
  .trend-good {
    color: var(--color-success);
  }
  .trend-bad {
    color: var(--color-danger);
  }
}
</style>
