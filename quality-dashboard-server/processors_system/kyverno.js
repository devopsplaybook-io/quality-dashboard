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
};

/** Look for the first .yaml or .yml file in a directory. */
async function findYamlFile(dir) {
  const files = await fse.readdir(dir);
  return files.find((f) => f.endsWith(".yaml") || f.endsWith(".yml")) || null;
}
