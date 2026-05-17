<template>
  <span v-if="trend === 'up'" class="trend trend-up" title="Increased">
    <i class="bi bi-arrow-up-short"></i>
  </span>
  <span v-else-if="trend === 'down'" class="trend trend-down" title="Decreased">
    <i class="bi bi-arrow-down-short"></i>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  reportKey: string;
  metricName: string;
  currentValue: number;
}>();

const reportsStore = ReportsStore();
const trend = ref<"up" | "down" | null>(null);

onMounted(async () => {
  try {
    const versions = await reportsStore.fetchVersionsForReport(props.reportKey);
    // Need at least 2 versions to compare (index 0 = latest, index 1 = previous)
    if (versions.length >= 2) {
      const prev = versions[1] as {
        metrics: { name: string; value: number }[];
      };
      const prevMetric = prev.metrics.find((m) => m.name === props.metricName);
      if (prevMetric) {
        if (props.currentValue > prevMetric.value) {
          trend.value = "up";
        } else if (props.currentValue < prevMetric.value) {
          trend.value = "down";
        }
      }
    }
  } catch {
    // Silently fail — trend just won't show
  }
});
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
.trend-up {
  color: #2e7d32;
}
.trend-down {
  color: #c62828;
}
@media (prefers-color-scheme: dark) {
  .trend-up {
    color: #66bb6a;
  }
  .trend-down {
    color: #ef5350;
  }
}
</style>
