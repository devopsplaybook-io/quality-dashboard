import type { Metric } from "~~/stores/ReportsStore";

/**
 * Simple glob matching for metric name patterns.
 * Supports:
 *  - `*` matches any sequence of characters (including empty)
 *  - `?` matches exactly one character
 *  - Literal characters match themselves (case-sensitive)
 *
 * The pattern is anchored (full-string match), so "kyverno.*" matches
 * "kyverno.audit.pass" but not "prefix-kyverno.audit.pass".
 */
export function matchGlob(name: string, pattern: string): boolean {
  let regexStr = "^";
  for (const ch of pattern) {
    if (ch === "*") {
      regexStr += ".*";
    } else if (ch === "?") {
      regexStr += ".";
    } else if (ch === ".") {
      // dot is a regex meta-character -- escape it
      regexStr += "\\.";
    } else {
      // all other characters: escape for regex safety
      regexStr += ch.replace(/[\\^$+{}()|[\]]/g, "\\$&");
    }
  }
  regexStr += "$";
  return new RegExp(regexStr).test(name);
}

/**
 * Filter metrics based on a list of glob patterns.
 * If `patterns` is undefined or empty, all metrics are returned unchanged.
 * Otherwise, only metrics whose name matches at least one pattern are kept.
 */
export function filterMetrics(
  metrics: Metric[],
  patterns: string[] | undefined,
): Metric[] {
  if (!patterns || patterns.length === 0) {
    return metrics;
  }
  return metrics.filter((m) =>
    patterns.some((p) => matchGlob(m.name, p)),
  );
}
