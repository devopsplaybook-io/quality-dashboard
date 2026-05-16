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
        <NuxtLink
          v-for="k in node.reportKeys"
          :key="k"
          :to="`/reports/${encodeURIComponent(k)}`"
          class="node-report-link"
        >
          {{ k }}
        </NuxtLink>
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

defineProps<{ node: AggregatedNode }>();
const expanded = ref(true);
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
  flex-wrap: wrap;
  gap: 0.3em;
  margin-bottom: 0.4em;
}
.node-report-link {
  font-size: 0.8em;
  color: #1976d2;
  text-decoration: none;
  background: #eceff1;
  padding: 0.1em 0.45em;
  border-radius: 3px;
}
.node-report-link:hover {
  text-decoration: underline;
}
@media (prefers-color-scheme: dark) {
  .dashboard-node {
    border-left-color: #455a64;
  }
  .node-report-link {
    background: #263238;
    color: #82b1ff;
  }
}
</style>
