import type { MetricType } from "~~/services/MetricTrend";

export function formatCount(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-9) {
    return Math.round(v).toString();
  }
  return v.toFixed(2);
}

export function formatPercentage(v: number): string {
  return `${v.toFixed(1)}%`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} h`;
  return `${Math.round(ms / 86_400_000)} d`;
}

export function formatMetricValue(type: MetricType, value: number): string {
  if (type === "percentage") {
    return formatPercentage(value);
  }
  if (type === "duration") {
    return formatDuration(value);
  }
  return formatCount(value);
}
