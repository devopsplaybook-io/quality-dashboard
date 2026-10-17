import { GateResult, GateRule, GateStatus } from "./models/GateRule";
import { Metric } from "./models/Metric";

/**
 * Pure evaluation of quality gate rules against a version's metrics.
 * - ">=": higher is better (fail when value < failValue, warn when value < warnValue).
 * - "<=": lower is better (fail when value > failValue, warn when value > warnValue).
 * - Rules whose metric is absent from the version are skipped, not failed.
 * - No evaluable rule ⇒ overall status is null (no gate).
 */
export class GateEvaluator {
  //
  public static evaluate(
    rules: GateRule[],
    metrics: Metric[],
  ): { status: GateStatus | null; results: GateResult[] } {
    const byName = new Map<string, number>();
    for (const m of metrics || []) {
      byName.set(m.name, Number(m.value));
    }
    const results: GateResult[] = [];
    let status: GateStatus | null = null;
    for (const rule of rules || []) {
      if (!byName.has(rule.metric)) {
        continue;
      }
      const value = byName.get(rule.metric) as number;
      let result: GateStatus;
      if (rule.operator === ">=") {
        result = value < rule.failValue ? "fail" : "pass";
        if (result === "pass" && rule.warnValue != null && value < rule.warnValue) {
          result = "warn";
        }
      } else {
        result = value > rule.failValue ? "fail" : "pass";
        if (result === "pass" && rule.warnValue != null && value > rule.warnValue) {
          result = "warn";
        }
      }
      results.push({
        ruleId: rule.id,
        metric: rule.metric,
        operator: rule.operator,
        value,
        status: result,
      });
      if (status === null) {
        status = result;
      } else if (result === "fail" || (result === "warn" && status === "pass")) {
        status = result;
      }
    }
    return { status, results };
  }
}
