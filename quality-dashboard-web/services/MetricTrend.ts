import type { Metric } from "~~/stores/ReportsStore";

export type MetricType = Metric["type"];

/** Compare the latest value against the value this many versions back. */
export const TREND_WINDOW = 5;

const LOWER_IS_BETTER_NAME_PARTS = [
  "fail",
  "error",
  "vulnerab",
  "violation",
  "issue",
  "warn",
  "critical",
];

export function lowerIsBetter(name: string, type: MetricType): boolean {
  if (type === "duration") {
    return true;
  }
  const lower = name.toLowerCase();
  return LOWER_IS_BETTER_NAME_PARTS.some((p) => lower.includes(p));
}

export function trendDirection(
  current: number,
  past: number,
  lower: boolean,
): "up" | "down" | null {
  if (current === past) {
    return null;
  }
  return current > past ? "up" : "down";
}

export function isImprovement(
  current: number,
  past: number,
  lower: boolean,
): boolean {
  const direction = trendDirection(current, past, lower);
  if (direction === null) {
    return false;
  }
  return lower ? direction === "down" : direction === "up";
}

/**
 * Value to compare the latest value of a chronological series against:
 * TREND_WINDOW versions back, falling back to the oldest available.
 * Returns null when there is nothing to compare with.
 */
export function windowPastValue(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  return values[Math.max(0, values.length - 1 - TREND_WINDOW)];
}
