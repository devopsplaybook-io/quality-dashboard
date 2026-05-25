/**
 * Kyverno PolicyReport Processor
 *
 * Parses the YAML output of `kubectl get polr -o yaml` (multi-document YAML
 * with one PolicyReport/ClusterPolicyReport per document) and extracts
 * pass/fail/warn/error counts from each report's summary section.
 *
 * Upload usage:
 *   kubectl get polr -n <ns> -o yaml > report.yaml
 *   curl -X POST $QD/api/reports \
 *     -H "X-Upload-Token: $QD_TOKEN" \
 *     -F 'meta={"key":"kyverno/ns/default","displayName":"Kyverno PolicyReports - default","processor":"kyverno"};type=application/json' \
 *     -F file=@report.yaml
 *
 * Accepts:
 *   - A .yaml/.yml file uploaded as the report file
 *   - jsonPayload.reports (pre-extracted array of report objects) as a fast path
 */

const fse = require("fs-extra");
const path = require("path");
const yaml = require("js-yaml");

module.exports = {
  describe: () => ({
    name: "kyverno",
    accepts: ["yaml"],
    summary:
      "Parses Kyverno PolicyReport YAML output into pass/fail/warn/error counts",
  }),

  analyse: async ({ reportDir, jsonPayload }) => {
    // -----------------------------------------------------------------------
    // 1) Collect report data — prefer jsonPayload.reports fast-path, else
    //    parse the YAML file(s) in the report directory.
    // -----------------------------------------------------------------------
    let reports = [];
    let fileEntrypoint;

    if (
      jsonPayload &&
      Array.isArray(jsonPayload.reports) &&
      jsonPayload.reports.length > 0
    ) {
      reports = jsonPayload.reports;
    } else {
      const yamlFile = await findYamlFile(reportDir);
      if (!yamlFile) {
        throw new Error(
          "kyverno: no .yaml/.yml file found in report directory",
        );
      }
      fileEntrypoint = yamlFile;

      const content = await fse.readFile(
        path.join(reportDir, yamlFile),
        "utf8",
      );

      // kubectl get -o yaml produces multi-document YAML (--- separators)
      // or a single PolicyReportList/ClusterPolicyReportList with an items array.
      const docs = yaml.safeLoadAll(content);
      for (const doc of docs) {
        if (!doc || !doc.kind) {
          continue;
        }

        // Case 1: List wrapper (PolicyReportList / ClusterPolicyReportList)
        if (doc.kind.endsWith("List") && Array.isArray(doc.items)) {
          for (const item of doc.items) {
            if (item && item.kind && item.kind.endsWith("PolicyReport")) {
              reports.push({
                name: (item.metadata || {}).name,
                namespace: (item.metadata || {}).namespace,
                summary: item.summary || {},
                results: (item.results || []).map((r) => ({
                  policy: r.policy,
                  rule: r.rule,
                  result: r.result,
                  severity: r.severity,
                })),
              });
            }
          }
          continue;
        }

        // Case 2: Single PolicyReport document (multi-document YAML)
        if (doc.kind.endsWith("PolicyReport")) {
          reports.push({
            name: (doc.metadata || {}).name,
            namespace: (doc.metadata || {}).namespace,
            summary: doc.summary || {},
            results: (doc.results || []).map((r) => ({
              policy: r.policy,
              rule: r.rule,
              result: r.result,
              severity: r.severity,
            })),
          });
        }
      }
    }

    if (reports.length === 0) {
      throw new Error(
        "kyverno: no valid PolicyReport/ClusterPolicyReport found",
      );
    }

    // -----------------------------------------------------------------------
    // 2) Aggregate metrics
    // -----------------------------------------------------------------------
    const totals = { pass: 0, fail: 0, warn: 0, error: 0 };
    const policyBreakdown = {};

    for (const report of reports) {
      const s = report.summary || {};
      totals.pass += s.pass || 0;
      totals.fail += s.fail || 0;
      totals.warn += s.warn || 0;
      totals.error += s.error || 0;

      if (report.results) {
        for (const r of report.results) {
          const pol = r.policy || "unknown";
          if (!policyBreakdown[pol]) {
            policyBreakdown[pol] = { pass: 0, fail: 0, warn: 0, error: 0 };
          }
          const resultKey = r.result || "unknown";
          if (resultKey in policyBreakdown[pol]) {
            policyBreakdown[pol][resultKey]++;
          }
        }
      }
    }

    return {
      fileEntrypoint,
      metrics: [
        {
          name: "kyverno.audit.total",
          type: "count",
          value: totals.pass + totals.fail + totals.warn + totals.error,
        },
        {
          name: "kyverno.audit.pass",
          type: "count",
          value: totals.pass,
        },
        {
          name: "kyverno.audit.fail",
          type: "count",
          value: totals.fail,
        },
        {
          name: "kyverno.audit.warn",
          type: "count",
          value: totals.warn,
        },
        {
          name: "kyverno.audit.error",
          type: "count",
          value: totals.error,
        },
      ],
      info: {
        source: "kyverno",
        reportCount: reports.length,
        policyBreakdown,
      },
    };
  },

  formatReportPreview: async ({ reportDir, fileEntrypoint }) => {
    // -----------------------------------------------------------------------
    // 1) Parse the YAML file(s) using the same logic as analyse()
    // -----------------------------------------------------------------------
    const yamlFile = fileEntrypoint || (await findYamlFile(reportDir));
    if (!yamlFile) {
      throw new Error("kyverno: no .yaml/.yml file found in report directory");
    }

    const content = await fse.readFile(path.join(reportDir, yamlFile), "utf8");

    const reports = [];
    const docs = yaml.safeLoadAll(content);
    for (const doc of docs) {
      if (!doc || !doc.kind) continue;

      if (doc.kind.endsWith("List") && Array.isArray(doc.items)) {
        for (const item of doc.items) {
          if (item && item.kind && item.kind.endsWith("PolicyReport")) {
            reports.push({
              name: (item.metadata || {}).name,
              namespace: (item.metadata || {}).namespace,
              summary: item.summary || {},
              results: item.results || [],
            });
          }
        }
        continue;
      }

      if (doc.kind.endsWith("PolicyReport")) {
        reports.push({
          name: (doc.metadata || {}).name,
          namespace: (doc.metadata || {}).namespace,
          summary: doc.summary || {},
          results: doc.results || [],
        });
      }
    }

    // -----------------------------------------------------------------------
    // 2) Compute aggregate totals
    // -----------------------------------------------------------------------
    const totals = { pass: 0, fail: 0, warn: 0, error: 0, skip: 0 };
    for (const r of reports) {
      const s = r.summary;
      totals.pass += s.pass || 0;
      totals.fail += s.fail || 0;
      totals.warn += s.warn || 0;
      totals.error += s.error || 0;
      totals.skip += s.skip || 0;
    }
    const grandTotal =
      totals.pass + totals.fail + totals.warn + totals.error + totals.skip;

    // -----------------------------------------------------------------------
    // 3) Build HTML
    // -----------------------------------------------------------------------
    const h = escapeHtml;

    const totalBadges = [
      ["pass", totals.pass, "#2e7d32"],
      ["fail", totals.fail, "#c62828"],
      ["warn", totals.warn, "#f57f17"],
      ["error", totals.error, "#b71c1c"],
      ["skip", totals.skip, "#546e7a"],
    ]
      .filter(([, count]) => count > 0)
      .map(
        ([label, count, color]) =>
          `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;color:#fff;background:${color}">${label === "pass" ? "&#10003;" : label === "fail" ? "&#10007;" : label === "warn" ? "&#9888;" : label === "error" ? "&#10008;" : "&#8212;"} ${count}</span>`,
      )
      .join(" ");

    const reportSections = reports.map((r) => buildReportSection(r)).join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #e0e0e0;
    background: #1a1a2e;
    margin: 0;
    padding: 16px;
  }
  .kp-header { margin-bottom: 16px; }
  .kp-header h2 { margin: 0 0 8px; font-size: 18px; color: #e0e0e0; }
  .kp-header .kp-meta { font-size: 12px; color: #9e9e9e; }
  .kp-totals { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .kp-report {
    border: 1px solid #333;
    border-radius: 8px;
    margin-bottom: 12px;
    background: #16213e;
    overflow: hidden;
  }
  .kp-report-summary {
    padding: 10px 14px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    background: #0f3460;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .kp-report-summary::-webkit-details-marker { display: none; }
  .kp-report[open] .kp-report-summary { border-bottom: 1px solid #333; }
  .kp-report-ns { font-weight: 400; font-size: 12px; color: #9e9e9e; }
  .kp-group {
    border-bottom: 1px solid #2a2a3e;
  }
  .kp-group:last-child { border-bottom: none; }
  .kp-group-summary {
    padding: 8px 14px 8px 28px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .kp-group-summary::-webkit-details-marker { display: none; }
  .kp-group[open] .kp-group-summary { border-bottom: 1px solid #2a2a3e; }
  .kp-group-pass    { background: rgba(46, 125, 50, 0.08); }
  .kp-group-fail    { background: rgba(198, 40, 40, 0.08); }
  .kp-group-warn    { background: rgba(245, 127, 23, 0.08); }
  .kp-group-error   { background: rgba(183, 28, 28, 0.08); }
  .kp-group-skip    { background: rgba(84, 110, 128, 0.08); }
  .kp-group-pass .kp-group-summary    { background: rgba(46, 125, 50, 0.12); }
  .kp-group-fail .kp-group-summary    { background: rgba(198, 40, 40, 0.12); }
  .kp-group-warn .kp-group-summary    { background: rgba(245, 127, 23, 0.12); }
  .kp-group-error .kp-group-summary   { background: rgba(183, 28, 28, 0.12); }
  .kp-group-skip .kp-group-summary    { background: rgba(84, 110, 128, 0.12); }
  .kp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    font-family: ui-monospace, "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
  }
  .kp-table th {
    text-align: left;
    padding: 6px 14px;
    font-weight: 600;
    color: #9e9e9e;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(0,0,0,0.2);
  }
  .kp-table td {
    padding: 4px 14px;
    border-top: 1px solid #2a2a3e;
    vertical-align: top;
  }
  .kp-table tr:first-child td { border-top: none; }
  .kp-result-badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #fff;
  }
  .kp-badge-pass  { background: #2e7d32; }
  .kp-badge-fail  { background: #c62828; }
  .kp-badge-warn  { background: #f57f17; }
  .kp-badge-error { background: #b71c1c; }
  .kp-badge-skip  { background: #546e7a; }
  .kp-empty {
    padding: 20px;
    text-align: center;
    color: #9e9e9e;
    font-style: italic;
  }
</style>
</head>
<body>
<div class="kp-header">
  <h2>Kyverno PolicyReport Preview</h2>
  <div class="kp-meta">${h(reports.length)} report(s) from ${h(path.basename(yamlFile))}</div>
</div>
${
  grandTotal > 0
    ? `<div class="kp-totals">${totalBadges}</div>`
    : '<div class="kp-empty">No policy results found.</div>'
}
${reportSections}
</body>
</html>`;
  },
};

/** Look for the first .yaml or .yml file in a directory. */
async function findYamlFile(dir) {
  const files = await fse.readdir(dir);
  return files.find((f) => f.endsWith(".yaml") || f.endsWith(".yml")) || null;
}

/**
 * Build a collapsible <details> section for one PolicyReport.
 */
function buildReportSection(report) {
  const h = escapeHtml;
  const title = report.name || "unknown";
  const ns = report.namespace || "";

  // Group results by result status
  const groups = { pass: [], fail: [], warn: [], error: [], skip: [] };
  for (const r of report.results) {
    const key = (r.result || "unknown").toLowerCase();
    if (key in groups) {
      groups[key].push(r);
    } else {
      groups.warn.push(r); // unknown -> warn
    }
  }

  const resultOrder = ["fail", "error", "warn", "pass", "skip"];
  let groupHtml = "";
  for (const status of resultOrder) {
    const items = groups[status];
    if (items.length === 0) continue;

    const icon =
      status === "pass"
        ? "&#10003;"
        : status === "fail"
          ? "&#10007;"
          : status === "warn"
            ? "&#9888;"
            : status === "error"
              ? "&#10008;"
              : "&#8212;";

    groupHtml += `<details class="kp-group kp-group-${status}" open>
  <summary class="kp-group-summary">${icon} <span class="kp-result-badge kp-badge-${status}">${status}</span> ${items.length}</summary>
  <table class="kp-table">
    <thead><tr><th>Policy</th><th>Rule</th><th>Severity</th></tr></thead>
    <tbody>${items
      .map(
        (r) =>
          `<tr><td>${h(r.policy || "")}</td><td>${h(r.rule || "")}</td><td>${h(r.severity || "-")}</td></tr>`,
      )
      .join("")}</tbody>
  </table>
</details>`;
  }

  return `<details class="kp-report"${report.results.length > 0 ? " open" : ""}>
  <summary class="kp-report-summary">${h(title)}${
    ns ? `<span class="kp-report-ns">${h(ns)}</span>` : ""
  }</summary>
  ${groupHtml || '<div class="kp-empty">No individual results (summary-only)</div>'}
</details>`;
}

function escapeHtml(str) {
  if (typeof str !== "string") return str == null ? "" : String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
