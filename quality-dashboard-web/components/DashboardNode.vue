<template>
  <div class="dashboard-node" :class="`level-${node.level}`">
    <div class="node-header" @click="toggle">
      <i
        class="bi caret"
        :class="expanded ? 'bi-caret-down-fill' : 'bi-caret-right-fill'"
      ></i>
      <strong class="node-label">{{ node.label }}</strong>
      <span class="node-count" :title="countTitle">
        {{ node.totalReportKeys }}
        <span class="node-count-suffix">
          report<span v-if="node.totalReportKeys !== 1">s</span>
        </span>
      </span>
      <div v-if="filteredMetrics.length > 0" class="node-metrics summary">
        <MetricChip
          v-for="m in filteredMetrics"
          :key="`${node.path}-${m.name}`"
          :metric="m"
          :aggregated="true"
        />
      </div>
    </div>

    <div v-show="expanded" v-if="hasOpenedOnce" class="node-body">
      <div v-if="nodeReports.length > 0" class="node-reports">
        <ReportCard
          v-for="report in nodeReports"
          :key="report.key"
          :report="report"
        />
      </div>
      <DashboardNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :default-expanded="defaultExpanded"
        :expand-bus="expandBus"
        :shown-metrics="shownMetrics"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AggregatedNode } from "~~/services/DashboardAggregator";
import type { Report } from "~~/stores/ReportsStore";
import { filterMetrics } from "~~/services/MetricFilter";

/** Bus for "expand all" / "collapse all" broadcasts from the page. */
export interface ExpandBus {
  /** Monotonically increasing token; node reacts when it changes. */
  token: number;
  /** Desired expansion state when token changes. */
  expanded: boolean;
}

const props = defineProps<{
  node: AggregatedNode;
  defaultExpanded?: boolean;
  expandBus?: ExpandBus;
  shownMetrics?: string[];
}>();

const expanded = ref(!!props.defaultExpanded);
// Lazy-mount: child subtree DOM is only created on first expand. After that,
// we use v-show so toggling stays instant and preserves any nested state.
const hasOpenedOnce = ref(expanded.value);

const reportsStore = ReportsStore();

const filteredMetrics = computed(() =>
  filterMetrics(props.node.metrics, props.shownMetrics),
);

const nodeReports = computed(() => {
  return props.node.reportKeys
    .map((k) => reportsStore.reportsByKey.get(k))
    .filter((r): r is Report => r !== undefined);
});

watch(
  () => props.expandBus?.token,
  () => {
    if (!props.expandBus) return;
    expanded.value = props.expandBus.expanded;
    if (expanded.value) {
      hasOpenedOnce.value = true;
    }
  },
);

function toggle(): void {
  expanded.value = !expanded.value;
  if (expanded.value) {
    hasOpenedOnce.value = true;
  }
}

const countTitle = computed(() => {
  const direct = props.node.reportKeys.length;
  const total = props.node.totalReportKeys;
  if (direct === total) return `${total} reports here`;
  return `${total} reports total (${direct} placed at this level)`;
});
</script>

<style scoped>
.dashboard-node {
  border-left: 2px solid var(--color-border);
  padding-left: var(--space-md);
  margin-bottom: var(--space-xs);
}
.dashboard-node.level-0 {
  border-left-color: var(--color-primary);
}
.node-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;
  user-select: none;
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}
.node-header:hover {
  background: var(--color-bg-hover);
}
.caret {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.node-label {
  font-family: ui-monospace, monospace;
  font-size: var(--font-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: 100%;
}
.node-count {
  color: var(--color-text-secondary);
  font-size: var(--font-md);
  background: var(--color-bg-hover);
  padding: 0.05em var(--space-sm);
  border-radius: 10px;
  white-space: nowrap;
}
.node-count-suffix {
  color: var(--color-text-muted);
}
.node-metrics.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2em;
  margin-left: auto;
  min-width: 0;
  max-width: 100%;
}
.node-body {
  padding: 0.2em 0 var(--space-sm) var(--space-compact);
}
.node-reports {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  margin-bottom: var(--space-sm);
}
@media (prefers-color-scheme: dark) {
  .dashboard-node {
    border-left-color: var(--color-border);
  }
  .dashboard-node.level-0 {
    border-left-color: var(--color-primary);
  }
  .node-header:hover {
    background: var(--color-bg-hover);
  }
  .node-count {
    background: var(--color-border-light);
    color: var(--color-text);
  }
  .node-count-suffix {
    color: var(--color-text-muted);
  }
}
</style>
