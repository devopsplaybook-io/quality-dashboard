import type { Metric } from "~~/stores/ReportsStore";
import type {
  DashboardLevelNode,
  DashboardReport,
} from "~~/stores/DashboardsStore";

/**
 * Aggregated tree node produced from a dashboard definition + report set.
 * Reports are placed at their DEEPEST matching node only; a report whose
 * tags do not match any child criterion stays at the current node.
 */
export interface AggregatedNode {
  /** Stable id, e.g. "tag1=value1 / tag3=value3" — used as Vue :key. */
  path: string;
  /** Display label, "tag=value". */
  label: string;
  /** Depth in the tree, 0-based. */
  level: number;
  /** Reports placed AT this node only (not in any descendant). */
  reportKeys: string[];
  /** Total reports including all descendants — for collapsed summary. */
  totalReportKeys: number;
  /** Aggregated metrics over self + descendants. */
  metrics: Metric[];
  /** Child nodes (already sorted alphabetically by label). */
  children: AggregatedNode[];
}

interface ReportLookup {
  byKey: Map<string, DashboardReport>;
  /** For each tag name -> map(reportKey -> value) */
  tagIndex: Map<string, Map<string, string>>;
}

function indexReports(reports: DashboardReport[]): ReportLookup {
  const byKey = new Map<string, DashboardReport>();
  const tagIndex = new Map<string, Map<string, string>>();
  for (const r of reports) {
    byKey.set(r.key, r);
    for (const t of r.tags || []) {
      let idx = tagIndex.get(t.tag);
      if (!idx) {
        idx = new Map();
        tagIndex.set(t.tag, idx);
      }
      idx.set(r.key, t.value);
    }
  }
  return { byKey, tagIndex };
}

/**
 * Sum (count, duration) or average (percentage, boolean) metric values across
 * a set of reports. Reports without a given metric simply don't contribute.
 */
function aggregateMetrics(
  reportKeys: string[],
  lookup: ReportLookup,
): Metric[] {
  const accum = new Map<
    string,
    { type: Metric["type"]; values: number[] }
  >();
  for (const k of reportKeys) {
    const r = lookup.byKey.get(k);
    if (!r) continue;
    for (const m of r.metrics) {
      let entry = accum.get(m.name);
      if (!entry) {
        entry = { type: m.type, values: [] };
        accum.set(m.name, entry);
      }
      entry.values.push(Number(m.value));
    }
  }
  const out: Metric[] = [];
  for (const [name, e] of accum.entries()) {
    let value = 0;
    if (e.type === "percentage" || e.type === "boolean") {
      value = e.values.reduce((a, b) => a + b, 0) / Math.max(1, e.values.length);
    } else {
      value = e.values.reduce((a, b) => a + b, 0);
    }
    out.push({ name, type: e.type, value });
  }
  return out;
}

/**
 * Build aggregated nodes for a single definition node, given a candidate
 * report set inherited from the parent.
 *
 *  - If `def.value` is set, this produces 0 or 1 aggregated nodes (filter only).
 *  - If `def.value` is absent, this produces one node per distinct value of
 *    `def.tag` among candidates (group-by).
 *  - Reports without `def.tag` (or with a non-matching value) drop out of this
 *    branch and remain on the parent's "placedHere" list.
 */
function buildNodes(
  def: DashboardLevelNode,
  candidateKeys: string[],
  lookup: ReportLookup,
  parentPath: string,
  level: number,
): { nodes: AggregatedNode[]; consumedKeys: Set<string> } {
  const tagValues = lookup.tagIndex.get(def.tag);
  const consumed = new Set<string>();
  if (!tagValues || candidateKeys.length === 0) {
    return { nodes: [], consumedKeys: consumed };
  }

  // Group candidate keys by value of def.tag (filtering out keys without the tag,
  // and applying the fixed value if present).
  const groups = new Map<string, string[]>();
  for (const k of candidateKeys) {
    const v = tagValues.get(k);
    if (v === undefined) continue;
    if (def.value !== undefined && v !== def.value) continue;
    const label = `${def.tag}=${v}`;
    let bucket = groups.get(label);
    if (!bucket) {
      bucket = [];
      groups.set(label, bucket);
    }
    bucket.push(k);
    consumed.add(k);
  }

  const nodes: AggregatedNode[] = [];
  for (const [label, keys] of groups.entries()) {
    const path = parentPath ? `${parentPath} / ${label}` : label;

    // Recurse into children; each child consumes a subset of `keys`.
    const childNodes: AggregatedNode[] = [];
    const consumedByChildren = new Set<string>();
    for (const child of def.children || []) {
      const r = buildNodes(child, keys, lookup, path, level + 1);
      for (const n of r.nodes) {
        childNodes.push(n);
      }
      for (const k of r.consumedKeys) {
        consumedByChildren.add(k);
      }
    }
    childNodes.sort((a, b) => a.label.localeCompare(b.label));

    const placedHere: string[] = [];
    for (const k of keys) {
      if (!consumedByChildren.has(k)) {
        placedHere.push(k);
      }
    }
    placedHere.sort();

    const totalReportKeys =
      placedHere.length +
      childNodes.reduce((a, c) => a + c.totalReportKeys, 0);

    const node: AggregatedNode = {
      path,
      label,
      level,
      reportKeys: placedHere,
      totalReportKeys,
      // Aggregate metrics across ALL reports in the subtree.
      metrics: aggregateMetrics(keys, lookup),
      children: childNodes,
    };
    nodes.push(node);
  }

  nodes.sort((a, b) => a.label.localeCompare(b.label));
  return { nodes, consumedKeys: consumed };
}

/**
 * Build the full aggregated tree for a dashboard.
 * Reports that don't match any top-level criterion are not displayed
 * (they belong to no branch).
 */
export function buildDashboardTree(
  defRoot: DashboardLevelNode[],
  reports: DashboardReport[],
): AggregatedNode[] {
  const lookup = indexReports(reports);
  const allKeys = reports.map((r) => r.key);
  const out: AggregatedNode[] = [];
  for (const def of defRoot || []) {
    const r = buildNodes(def, allKeys, lookup, "", 0);
    for (const n of r.nodes) {
      out.push(n);
    }
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}
