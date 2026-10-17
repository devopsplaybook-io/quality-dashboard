<template>
  <span
    class="metric-chip"
    :class="[`metric-chip-${metric.type}`, gateStatus ? `metric-chip-gate-${gateStatus}` : '']"
    :title="title"
  >
    <i
      v-if="gateStatus"
      class="metric-chip-gate-icon bi"
      :class="gateIcon"
      :title="gateTitle"
    ></i>
    <span class="metric-chip-name">{{ metric.name }}</span>
    <span class="metric-chip-value">
      <template v-if="metric.type === 'percentage'">{{
        formatPercentage(metric.value)
      }}</template>
      <template v-else-if="metric.type === 'duration'">{{
        formatDuration(metric.value)
      }}</template>
      <template v-else-if="metric.type === 'boolean'">
        <i v-if="metric.value" class="bi bi-check-circle-fill"></i>
        <i v-else class="bi bi-x-circle-fill"></i>
      </template>
      <template v-else>{{ formatCount(metric.value) }}</template>
    </span>
  </span>
</template>

<script setup lang="ts">
import type { Metric, GateStatus } from "~~/stores/ReportsStore";
import { formatCount, formatDuration, formatPercentage } from "~~/services/MetricFormat";

const props = defineProps<{
  metric: Metric;
  /** When true, the chip represents an aggregated value over multiple reports. */
  aggregated?: boolean;
  /** Quality gate status to highlight (from the version's gate results). */
  gateStatus?: GateStatus | null;
}>();

const gateIcon = computed(() => {
  switch (props.gateStatus) {
    case "pass":
      return "bi-check-circle-fill";
    case "warn":
      return "bi-exclamation-triangle-fill";
    case "fail":
      return "bi-x-circle-fill";
    default:
      return "";
  }
});

const gateTitle = computed(() => {
  switch (props.gateStatus) {
    case "pass":
      return "Gate: passing";
    case "warn":
      return "Gate: warning";
    case "fail":
      return "Gate: failing";
    default:
      return "";
  }
});

const title = computed(() => {
  const a = props.aggregated ? " (aggregated)" : "";
  return `${props.metric.name}${a}`;
});
</script>

<style scoped>
.metric-chip {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-sm);
  padding: 0.15em 0.55em;
  margin: 0.15em 0.25em 0.15em 0;
  border-radius: var(--radius-full);
  font-size: var(--font-base);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}
.metric-chip-gate-icon {
  align-self: center;
  font-size: 0.85em;
}
.metric-chip-gate-pass {
  border-color: #66bb6a;
  background-color: #e8f5e9;
}
.metric-chip-gate-warn {
  border-color: #ffca28;
  background-color: #fff8e1;
}
.metric-chip-gate-fail {
  border-color: #e57373;
  background-color: #ffebee;
}
.metric-chip-gate-pass .metric-chip-gate-icon,
.metric-chip-gate-pass .metric-chip-value {
  color: #2e7d32;
}
.metric-chip-gate-warn .metric-chip-gate-icon,
.metric-chip-gate-warn .metric-chip-value {
  color: #b28704;
}
.metric-chip-gate-fail .metric-chip-gate-icon,
.metric-chip-gate-fail .metric-chip-value {
  color: #c62828;
}
.metric-chip-name {
  font-weight: 500;
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 12ch;
  direction: rtl;
  text-align: left;
}
.metric-chip-value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.metric-chip-count {
  border-color: var(--color-text-placeholder);
}
.metric-chip-percentage {
  border-color: #90caf9;
  background-color: var(--color-primary-light);
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
    background-color: var(--color-bg-secondary);
    border-color: var(--color-border);
    color: var(--color-text);
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
  .metric-chip-gate-pass {
    background-color: #1f3d24;
    border-color: #66bb6a;
  }
  .metric-chip-gate-warn {
    background-color: #4a3b12;
    border-color: #ffca28;
  }
  .metric-chip-gate-fail {
    background-color: #4a1f1f;
    border-color: #e57373;
  }
  .metric-chip-gate-pass .metric-chip-gate-icon,
  .metric-chip-gate-pass .metric-chip-value {
    color: #81c784;
  }
  .metric-chip-gate-warn .metric-chip-gate-icon,
  .metric-chip-gate-warn .metric-chip-value {
    color: #ffd54f;
  }
  .metric-chip-gate-fail .metric-chip-gate-icon,
  .metric-chip-gate-fail .metric-chip-value {
    color: #e57373;
  }
}
</style>
