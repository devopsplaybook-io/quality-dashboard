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
      <div v-if="node.reportKeys.length > 0" class="node-reports">
        <div v-for="k in node.reportKeys" :key="k" class="node-report-line">
          <NuxtLink
            :to="`/reports/${encodeURIComponent(k)}`"
            class="node-report-link"
          >
            {{ k }}
          </NuxtLink>
          <div v-if="getReportLatest(k)" class="node-report-metrics">
            <span
              v-for="m in getReportLatest(k)!.metrics"
              :key="m.name"
              class="nm-chip"
              :class="nmClass(m)"
              :title="m.name"
            >
              {{ nmLabel(m) }}
            </span>
            <span class="nm-date">
              <i class="bi bi-clock"></i>
              {{ nmRelative(getReportLatest(k)!.dateCreated) }}
            </span>
          </div>
        </div>
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
import type { Metric } from "~~/stores/ReportsStore";

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

const now = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = Date.now();
  }, 30000);
});

onBeforeUnmount(() => {
  if (nowTimer !== null) {
    clearInterval(nowTimer);
    nowTimer = null;
  }
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

function getReportLatest(key: string): {
  metrics: Metric[];
  dateCreated: string;
} | null {
  const report = reportsStore.reportsByKey.get(key);
  if (!report || !report.latestVersion) return null;
  return {
    metrics: report.latestVersion.metrics,
    dateCreated: report.latestVersion.dateCreated,
  };
}

function nmLabel(m: Metric): string {
  switch (m.type) {
    case "percentage":
      return `${m.value}%`;
    case "duration":
      if (m.value >= 60) {
        return `${(m.value / 60).toFixed(1)}m`;
      }
      return `${m.value}s`;
    case "boolean":
      return m.value ? "\u2713" : "\u2717";
    default:
      return String(m.value);
  }
}

function nmClass(m: Metric): string {
  switch (m.type) {
    case "boolean":
      return m.value ? "nm-good" : "nm-bad";
    case "percentage":
      if (m.value >= 80) return "nm-good";
      if (m.value >= 50) return "nm-warn";
      return "nm-bad";
    default:
      return "";
  }
}

function nmRelative(iso: string): string {
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
.node-report-line {
  display: flex;
  flex-direction: column;
  gap: 0.1em;
}
.node-report-link {
  font-size: 0.8em;
  color: #1976d2;
  text-decoration: none;
  background: #eceff1;
  padding: 0.1em 0.45em;
  border-radius: 3px;
  display: inline-block;
  width: fit-content;
}
.node-report-link:hover {
  text-decoration: underline;
}
.node-report-metrics {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25em 0.4em;
  padding-left: 0.3em;
}
.nm-chip {
  font-size: 0.7em;
  padding: 0.08em 0.35em;
  border-radius: 3px;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
  background: #eceff1;
  color: #455a64;
}
.nm-good {
  background: #e8f5e9;
  color: #2e7d32;
}
.nm-warn {
  background: #fff8e1;
  color: #f57f17;
}
.nm-bad {
  background: #ffebee;
  color: #c62828;
}
.nm-date {
  font-size: 0.7em;
  color: #90a4ae;
  white-space: nowrap;
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
  .node-report-link {
    background: #263238;
    color: #82b1ff;
  }
  .nm-chip {
    background: #37474f;
    color: #cfd8dc;
  }
  .nm-good {
    background: #1b5e20;
    color: #a5d6a7;
  }
  .nm-warn {
    background: #e65100;
    color: #ffe0b2;
  }
  .nm-bad {
    background: #b71c1c;
    color: #ef9a9a;
  }
  .nm-date {
    color: #546e7a;
  }
}
</style>
