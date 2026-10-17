<template>
  <div class="gate-rules-editor">
    <div v-if="rows.length > 0" class="gate-rule-list">
      <div
        v-for="(row, i) in rows"
        :key="i"
        class="gate-rule-row"
      >
        <input
          v-model="row.metric"
          class="gate-rule-input gate-rule-metric"
          type="text"
          placeholder="metric name (e.g. tests.failed)"
          :disabled="!editable"
        />
        <select
          v-model="row.operator"
          class="gate-rule-input gate-rule-operator"
          :disabled="!editable"
          :title="row.operator === '>=' ? 'Higher is better' : 'Lower is better'"
        >
          <option value="<=">≤ lower is better</option>
          <option value=">=">≥ higher is better</option>
        </select>
        <input
          v-model="row.warnValue"
          class="gate-rule-input gate-rule-number"
          type="number"
          step="any"
          placeholder="warn"
          title="Optional warning threshold"
          :disabled="!editable"
        />
        <input
          v-model="row.failValue"
          class="gate-rule-input gate-rule-number"
          type="number"
          step="any"
          placeholder="fail"
          title="Fail threshold"
          :disabled="!editable"
        />
        <button
          v-if="editable"
          class="gate-rule-remove"
          type="button"
          title="Remove rule"
          aria-label="Remove rule"
          @click="removeRow(i)"
        >
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
    </div>
    <p v-else-if="!editable" class="gate-rules-empty">
      No quality gate rules configured.
    </p>

    <div v-if="editable" class="gate-rule-actions">
      <button class="btn-secondary" type="button" @click="addRow">
        <i class="bi bi-plus"></i> Add rule
      </button>
      <button
        class="btn-primary"
        type="button"
        :disabled="!isDirty"
        @click="save"
      >
        <i class="bi bi-check-lg"></i> Save gates
      </button>
      <button
        v-if="isDirty"
        class="btn-secondary"
        type="button"
        @click="resetRows"
      >
        Cancel
      </button>
    </div>
    <p v-if="editable && validationError" class="gate-rules-error">
      <i class="bi bi-exclamation-triangle-fill"></i> {{ validationError }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { GateRule } from "~~/stores/ReportsStore";

const props = defineProps<{
  rules: GateRule[];
  /** Editable only for authenticated users; read-only otherwise. */
  editable?: boolean;
}>();

const emit = defineEmits<{
  save: [rules: { metric: string; operator: "<=" | ">="; warnValue: number | null; failValue: number }[]];
}>();

interface Row {
  metric: string;
  operator: "<=" | ">=";
  warnValue: string;
  failValue: string;
}

const rows = ref<Row[]>([]);

function rowsFromRules(rules: GateRule[]): Row[] {
  return (rules || []).map((r) => ({
    metric: r.metric,
    operator: r.operator,
    warnValue: r.warnValue == null ? "" : String(r.warnValue),
    failValue: String(r.failValue),
  }));
}

function resetRows(): void {
  rows.value = rowsFromRules(props.rules);
}

watch(() => props.rules, resetRows, { immediate: true, deep: true });

const isDirty = computed(() => {
  const saved = rowsFromRules(props.rules);
  if (saved.length !== rows.value.length) return true;
  return saved.some(
    (s, i) =>
      s.metric !== rows.value[i].metric ||
      s.operator !== rows.value[i].operator ||
      s.warnValue !== rows.value[i].warnValue ||
      s.failValue !== rows.value[i].failValue,
  );
});

const validationError = computed(() => {
  for (const row of rows.value) {
    if (!row.metric.trim()) continue;
    if (row.failValue.trim() === "" || !Number.isFinite(Number(row.failValue))) {
      return `Rule "${row.metric.trim()}" needs a numeric fail threshold.`;
    }
    if (
      row.warnValue.trim() !== "" &&
      !Number.isFinite(Number(row.warnValue))
    ) {
      return `Rule "${row.metric.trim()}" has an invalid warn threshold.`;
    }
  }
  return null;
});

function addRow(): void {
  rows.value.push({
    metric: "",
    operator: "<=",
    warnValue: "",
    failValue: "",
  });
}

function removeRow(i: number): void {
  rows.value.splice(i, 1);
}

function save(): void {
  if (validationError.value) return;
  const cleaned = rows.value
    .filter((r) => r.metric.trim() && r.failValue.trim() !== "")
    .map((r) => ({
      metric: r.metric.trim(),
      operator: r.operator,
      warnValue:
        r.warnValue.trim() === "" ? null : Number(r.warnValue.trim()),
      failValue: Number(r.failValue.trim()),
    }));
  emit("save", cleaned);
}
</script>

<style scoped>
.gate-rules-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.gate-rule-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}
.gate-rule-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}
.gate-rule-input {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-body);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  box-sizing: border-box;
}
.gate-rule-input:disabled {
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  opacity: 0.85;
}
.gate-rule-metric {
  flex: 2 1 200px;
  min-width: 0;
  font-family: ui-monospace, monospace;
}
.gate-rule-operator {
  flex: 0 0 auto;
}
.gate-rule-number {
  flex: 1 1 90px;
  min-width: 0;
}
.gate-rule-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2em;
  width: 2em;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 1em;
  flex-shrink: 0;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}
.gate-rule-remove:hover {
  color: var(--color-danger);
  background: #ffebee;
}
.gate-rule-actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
.gate-rules-empty {
  margin: 0;
  color: var(--color-text-muted);
  font-style: italic;
  font-size: var(--font-base);
}
.gate-rules-error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-base);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
@media (max-width: 640px) {
  .gate-rule-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .gate-rule-metric {
    grid-column: 1 / -1;
  }
}
@media (prefers-color-scheme: dark) {
  .gate-rule-input {
    background: var(--color-bg);
    border-color: var(--color-border);
    color: var(--color-text);
  }
  .gate-rule-input:disabled {
    background: var(--color-bg-secondary);
    color: var(--color-text-muted);
  }
  .gate-rule-remove:hover {
    color: var(--color-danger);
    background: #3e2723;
  }
}
</style>
