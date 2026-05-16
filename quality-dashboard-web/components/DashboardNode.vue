<template>
  <div class="dashboard-node" :style="{ marginLeft: `${node.level * 1.2}em` }">
    <div class="node-header" @click="expanded = !expanded">
      <i
        class="bi"
        :class="expanded ? 'bi-caret-down-fill' : 'bi-caret-right-fill'"
      ></i>
      <strong>{{ node.label }}</strong>
      <span class="node-count"
        >({{ node.reportKeys.length }} report<span
          v-if="node.reportKeys.length !== 1"
          >s</span
        >)</span
      >
    </div>
    <div v-if="expanded" class="node-body">
      <div v-if="node.metrics.length > 0" class="node-metrics">
        <MetricChip
          v-for="m in node.metrics"
          :key="`${node.label}-${m.name}`"
          :metric="m"
          :aggregated="true"
        />
      </div>
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
        v-for="(child, i) in node.children"
        :key="`${i}-${child.label}`"
        :node="child"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AggregatedNode } from "~~/stores/DashboardsStore";
import type { Metric } from "~~/stores/ReportsStore";

const props = defineProps<{ node: AggregatedNode }>();
const expanded = ref(true);

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

function getReportLatest(key: string) {
  const report = reportsStore.reportsByKey.get(key);
  return report?.latestVersion ?? null;
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
  margin-bottom: 0.4em;
}
.node-header {
  display: flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.3em 0;
  cursor: pointer;
  user-select: none;
}
.node-count {
  color: #78909c;
  font-size: 0.85em;
}
.node-body {
  padding: 0.2em 0 0.3em;
}
.node-metrics {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 0.3em;
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
