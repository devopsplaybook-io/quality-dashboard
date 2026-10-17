/**
 * A quality gate rule attached to a Report, evaluated on every upload
 * (and retro-applied to all versions when rules are saved).
 */
export type GateOperator = "<=" | ">=";

/** Overall gate status of a version: worst result across evaluable rules. */
export type GateStatus = "pass" | "warn" | "fail";

export interface GateRule {
  id: string;
  /** Metric name the rule applies to (exact, case-sensitive). */
  metric: string;
  /** "<=" = lower is better; ">=" = higher is better. */
  operator: GateOperator;
  /** Optional threshold above/below which the rule is only a warning. */
  warnValue?: number | null;
  /** Threshold at/beyond which the rule fails. */
  failValue: number;
  dateCreated: Date;
}

/** Result of evaluating one rule against one version. */
export interface GateResult {
  ruleId: string;
  metric: string;
  operator: GateOperator;
  /** Observed metric value; null when the metric was absent from the version. */
  value: number | null;
  status: GateStatus;
}
