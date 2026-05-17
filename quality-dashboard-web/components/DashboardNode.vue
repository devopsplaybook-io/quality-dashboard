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
      <div v-if="node.metrics.length > 0" class="node-metrics summary">
        <MetricChip
          v-for="m in node.metrics"
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
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AggregatedNode } from "~~/services/DashboardAggregator";
import type { Report } from "~~/stores/ReportsStore";

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
}>();

const expanded = ref(!!props.defaultExpanded);
// Lazy-mount: child subtree DOM is only created on first expand. After that,
// we use v-show so toggling stays instant and preserves any nested state.
const hasOpenedOnce = ref(expanded.value);

const reportsStore = ReportsStore();

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
  border-left: 2px solid #cfd8dc;
  padding-left: 0.5em;
  margin-bottom: 0.3em;
}
.dashboard-node.level-0 {
  border-left-color: #1976d2;
}
.node-header {
  display: flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.3em 0.4em;
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
  flex-wrap: wrap;
}
.node-header:hover {
  background: #eceff1;
}
.caret {
  color: #78909c;
  flex-shrink: 0;
}
.node-label {
  font-family: ui-monospace, monospace;
  font-size: 0.95em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: 100%;
}
.node-count {
  color: #455a64;
  font-size: 0.8em;
  background: #eceff1;
  padding: 0.05em 0.4em;
  border-radius: 10px;
  white-space: nowrap;
}
.node-count-suffix {
  color: #78909c;
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
  padding: 0.2em 0 0.4em 0.6em;
}
.node-reports {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  margin-bottom: 0.4em;
}
@media (prefers-color-scheme: dark) {
  .dashboard-node {
    border-left-color: #455a64;
  }
  .dashboard-node.level-0 {
    border-left-color: #1976d2;
  }
  .node-header:hover {
    background: #263238;
  }
  .node-count {
    background: #37474f;
    color: #cfd8dc;
  }
  .node-count-suffix {
    color: #90a4ae;
  }
}
</style>
