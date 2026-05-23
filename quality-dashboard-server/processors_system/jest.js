/**
 * Jest Test Results & Coverage Processor
 *
 * Parses the output of `jest --json --outputFile=test-results.json --coverage`
 * (or a zip containing the coverage/ directory) and extracts:
 *   - Test counts: total, passed, failed, skipped
 *   - Coverage percentages: statements, branches, functions, lines
 *
 * Expected zip contents:
 *   test-results.json    – Jest JSON output (--json --outputFile=test-results.json)
 *   coverage-final.json  – Istanbul JSON coverage summary
 *   clover.xml           – Clover XML coverage report (alternative to coverage-final.json)
 *   lcov.info / lcov-report/ – (ignored; coverage-final.json is preferred)
 *
 * Upload usage:
 *   curl -X POST $QD/api/reports \
 *     -H "X-Upload-Token: $QD_TOKEN" \
 *     -F 'meta={"key":"jest/my-service","displayName":"Jest Tests - my-service","processor":"jest"};type=application/json' \
 *     -F file=@coverage.zip
 */

const fse = require("fs-extra");
const path = require("path");

module.exports = {
  describe: () => ({
    name: "jest",
    accepts: ["zip"],
    summary:
      "Parses Jest JSON test results and coverage output into test counts and coverage percentages",
  }),

  analyse: async ({ reportDir }) => {
    // -----------------------------------------------------------------------
    // 1) Parse test results (optional – may not be in the zip)
    // -----------------------------------------------------------------------
    const testResults = await findAndParseJson(reportDir, "test-results.json");
    const testCounts = testResults
      ? {
          total: testResults.numTotalTests || 0,
          passed: testResults.numPassedTests || 0,
          failed: testResults.numFailedTests || 0,
          skipped: testResults.numPendingTests || 0,
        }
      : null;

    // -----------------------------------------------------------------------
    // 2) Parse coverage data
    // -----------------------------------------------------------------------
    const coverage = await parseCoverage(reportDir);

    // -----------------------------------------------------------------------
    // 3) Build metrics
    // -----------------------------------------------------------------------
    const metrics = [];
    let fileEntrypoint;

    if (testCounts) {
      fileEntrypoint = "test-results.json";
      metrics.push(
        { name: "jest.tests.total", type: "count", value: testCounts.total },
        {
          name: "jest.tests.passed",
          type: "count",
          value: testCounts.passed,
        },
        {
          name: "jest.tests.failed",
          type: "count",
          value: testCounts.failed,
        },
        {
          name: "jest.tests.skipped",
          type: "count",
          value: testCounts.skipped,
        },
      );
    }

    if (coverage) {
      if (!fileEntrypoint) fileEntrypoint = coverage.entrypoint;
      metrics.push(
        {
          name: "jest.coverage.statements",
          type: "percentage",
          value: coverage.statements,
        },
        {
          name: "jest.coverage.branches",
          type: "percentage",
          value: coverage.branches,
        },
        {
          name: "jest.coverage.functions",
          type: "percentage",
          value: coverage.functions,
        },
        {
          name: "jest.coverage.lines",
          type: "percentage",
          value: coverage.lines,
        },
      );
    }

    if (metrics.length === 0) {
      throw new Error(
        "jest: no test-results.json or coverage-final.json/clover.xml found in report directory",
      );
    }

    return {
      fileEntrypoint,
      metrics,
      info: {
        source: "jest",
        testResults: testCounts,
        coverage: coverage
          ? {
              statements: coverage.statements,
              branches: coverage.branches,
              functions: coverage.functions,
              lines: coverage.lines,
            }
          : undefined,
      },
    };
  },

  formatReportPreview: async ({ reportDir, fileEntrypoint }) => {
    // -----------------------------------------------------------------------
    // 1) Re-parse data (same logic as analyse)
    // -----------------------------------------------------------------------
    const testResults = await findAndParseJson(reportDir, "test-results.json");
    const testCounts = testResults
      ? {
          total: testResults.numTotalTests || 0,
          passed: testResults.numPassedTests || 0,
          failed: testResults.numFailedTests || 0,
          skipped: testResults.numPendingTests || 0,
        }
      : null;

    const coverage = await parseCoverage(reportDir);

    // -----------------------------------------------------------------------
    // 2) Build HTML preview
    // -----------------------------------------------------------------------
    const h = escapeHtml;

    // -- Test summary badges ------------------------------------------------
    let testBadgesHtml = "";
    if (testCounts) {
      testBadgesHtml = [
        ["Passed", testCounts.passed, "#2e7d32", "&#10003;"],
        ["Failed", testCounts.failed, "#c62828", "&#10007;"],
        ["Skipped", testCounts.skipped, "#546e7a", "&#8212;"],
      ]
        .filter(([, count]) => count > 0)
        .map(
          ([label, count, color, icon]) =>
            `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 14px;border-radius:12px;font-size:13px;font-weight:600;color:#fff;background:${color}">${icon} ${count} ${label}</span>`,
        )
        .join(" ");
    }

    // -- Per-file coverage table --------------------------------------------
    let perFileHtml = "";
    let totalTestsInfo = "";

    if (testCounts) {
      totalTestsInfo = `${h(testCounts.total)} test(s)`;
      if (testCounts.total > 0) {
        const passRate = ((testCounts.passed / testCounts.total) * 100).toFixed(
          1,
        );
        totalTestsInfo += ` &middot; ${passRate}% pass rate`;
      }
    }

    let coverageSummaryHtml = "";
    let coverageTableHtml =
      '<div class="jp-empty">No coverage data available.</div>';

    if (coverage) {
      // -- Coverage summary cards -------------------------------------------
      const covItems = [
        ["Statements", coverage.statements],
        ["Branches", coverage.branches],
        ["Functions", coverage.functions],
        ["Lines", coverage.lines],
      ];

      coverageSummaryHtml = covItems
        .map(
          ([label, pct]) =>
            `<div class="jc-card">
          <div style="font-size:24px;font-weight:700;${
            pct >= 80
              ? "color:#2e7d32"
              : pct >= 50
                ? "color:#f57f17"
                : "color:#c62828"
          }">${pct.toFixed(1)}%</div>
          <div style="font-size:11px;color:#9e9e9e;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
          <div class="jc-bar-track"><div class="jc-bar-fill" style="width:${Math.min(pct, 100)}%;${pct >= 80 ? "background:#2e7d32" : pct >= 50 ? "background:#f57f17" : "background:#c62828"}"></div></div>
        </div>`,
        )
        .join("");

      // -- Per-file table ---------------------------------------------------
      if (coverage.perFile && coverage.perFile.length > 0) {
        const sorted = [...coverage.perFile].sort(
          (a, b) => a.statements - b.statements,
        );
        coverageTableHtml = `<table class="jc-table">
          <thead><tr><th>File</th><th>Statements</th><th>Branches</th><th>Functions</th><th>Lines</th></tr></thead>
          <tbody>${sorted
            .map(
              (f) => `<tr>
              <td style="font-family:monospace;font-size:12px;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${h(f.name)}">${h(f.name)}</td>
              ${["statements", "branches", "functions", "lines"]
                .map((key) => {
                  const pct = f[key];
                  const color =
                    pct >= 80 ? "#2e7d32" : pct >= 50 ? "#f57f17" : "#c62828";
                  return `<td><span style="color:${color};font-weight:600">${pct.toFixed(1)}%</span></td>`;
                })
                .join("")}
            </tr>`,
            )
            .join("")}</tbody>
        </table>`;
      }
    }

    // -- Test suites breakdown ----------------------------------------------
    let suitesHtml = "";
    if (testResults && Array.isArray(testResults.testResults)) {
      const suites = testResults.testResults;
      if (suites.length > 0) {
        const sortedSuites = [...suites].sort((a, b) => {
          const aFail = (a.assertionResults || []).filter(
            (r) => r.status === "failed",
          ).length;
          const bFail = (b.assertionResults || []).filter(
            (r) => r.status === "failed",
          ).length;
          return bFail - aFail;
        });

        suitesHtml = sortedSuites
          .map((suite) => {
            const assertions = suite.assertionResults || [];
            const suitePassed = assertions.filter(
              (r) => r.status === "passed",
            ).length;
            const suiteFailed = assertions.filter(
              (r) => r.status === "failed",
            ).length;
            const suiteSkipped = assertions.filter(
              (r) =>
                r.status === "pending" ||
                r.status === "skipped" ||
                r.status === "disabled",
            ).length;
            const suiteIcon =
              suiteFailed > 0
                ? "&#10007;"
                : suiteSkipped === assertions.length && assertions.length > 0
                  ? "&#8212;"
                  : "&#10003;";
            const suiteColor = suiteFailed > 0 ? "#c62828" : "#2e7d32";
            const suiteName = suite.displayName
              ? suite.displayName
              : suite.name
                ? path.basename(suite.name)
                : "unknown";

            const assertionRows = assertions
              .map((a) => {
                const status = a.status || "unknown";
                const statusIcon =
                  status === "passed"
                    ? "&#10003;"
                    : status === "failed"
                      ? "&#10007;"
                      : "&#8212;";
                const statusColor =
                  status === "passed"
                    ? "#2e7d32"
                    : status === "failed"
                      ? "#c62828"
                      : "#546e7a";
                const title = a.fullName || a.title || "(unnamed)";
                let failureHtml = "";
                if (
                  status === "failed" &&
                  (a.failureMessages || []).length > 0
                ) {
                  const msgs = a.failureMessages
                    .map((msg) => {
                      const short = msg.split("\n").slice(0, 6).join("\n");
                      return h(short);
                    })
                    .join("\n\n---\n\n");
                  failureHtml = `<pre class="jc-failure">${msgs}</pre>`;
                }
                return `<tr>
              <td style="text-align:center"><span style="color:${statusColor};font-weight:700">${statusIcon}</span></td>
              <td style="font-size:13px">${h(title)}</td>
            </tr>${failureHtml ? `<tr><td></td><td>${failureHtml}</td></tr>` : ""}`;
              })
              .join("");

            return `<details class="jc-suite"${suiteFailed > 0 ? " open" : ""}>
          <summary class="jc-suite-summary" style="color:${suiteColor}">
            <span>${suiteIcon}</span>
            <span class="jc-suite-name">${h(suiteName)}</span>
            <span class="jc-suite-counts">
              <span style="color:#2e7d32">${suitePassed}</span>
              ${suiteFailed > 0 ? `<span style="color:#c62828"> / ${suiteFailed} failed</span>` : ""}
              ${suiteSkipped > 0 ? `<span style="color:#546e7a"> / ${suiteSkipped} skipped</span>` : ""}
            </span>
          </summary>
          <table class="jp-table">
            <thead><tr><th style="width:32px">Status</th><th>Test</th></tr></thead>
            <tbody>${assertionRows}</tbody>
          </table>
        </details>`;
          })
          .join("");
      }
    }

    // -- Assemble page ------------------------------------------------------
    const pageTitle = testCounts
      ? `Jest Test Results${coverage ? " & Coverage" : ""}`
      : "Jest Coverage Report";

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
  .jc-header { margin-bottom: 16px; }
  .jc-header h2 { margin: 0 0 4px; font-size: 18px; color: #e0e0e0; }
  .jc-header .jc-meta { font-size: 12px; color: #9e9e9e; }
  .jc-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .jc-cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
  .jc-card {
    display: flex; flex-direction: column; gap: 6px;
    padding: 12px 18px; border-radius: 8px;
    background: #16213e; border: 1px solid #333;
    min-width: 120px;
  }
  .jc-bar-track {
    height: 4px; background: #2a2a3e; border-radius: 2px; overflow: hidden;
  }
  .jc-bar-fill {
    height: 100%; border-radius: 2px; transition: width 0.3s;
  }
  .jc-section {
    border: 1px solid #333;
    border-radius: 8px;
    margin-bottom: 12px;
    background: #16213e;
    overflow: hidden;
  }
  .jc-section-title {
    padding: 10px 14px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    background: #0f3460;
    user-select: none;
  }
  .jc-section[open] .jc-section-title { border-bottom: 1px solid #333; }
  .jp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .jp-table th {
    text-align: left;
    padding: 6px 14px;
    font-weight: 600;
    color: #9e9e9e;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(0,0,0,0.2);
  }
  .jp-table td {
    padding: 6px 14px;
    border-top: 1px solid #2a2a3e;
    vertical-align: top;
  }
  .jp-table tr:first-child td { border-top: none; }
  .jc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .jc-table th {
    text-align: left;
    padding: 6px 14px;
    font-weight: 600;
    color: #9e9e9e;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(0,0,0,0.2);
  }
  .jc-table td {
    padding: 6px 14px;
    border-top: 1px solid #2a2a3e;
    vertical-align: middle;
  }
  .jc-table tr:first-child td { border-top: none; }
  .jc-table tr:hover td { background: rgba(255,255,255,0.03); }
  .jc-suite {
    border: 1px solid #333;
    border-radius: 6px;
    margin-bottom: 8px;
    background: #16213e;
    overflow: hidden;
  }
  .jc-suite-summary {
    padding: 8px 14px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    background: #0f3460;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .jc-suite-summary::-webkit-details-marker { display: none; }
  .jc-suite[open] .jc-suite-summary { border-bottom: 1px solid #333; }
  .jc-suite-name { flex: 1; }
  .jc-suite-counts { font-weight: 400; font-size: 12px; color: #9e9e9e; }
  .jc-failure {
    margin: 4px 0;
    padding: 8px;
    border-radius: 4px;
    background: rgba(198,40,40,0.08);
    border: 1px solid rgba(198,40,40,0.2);
    font-family: ui-monospace, "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
    font-size: 11px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
    color: #ef9a9a;
    max-height: 200px;
    overflow-y: auto;
  }
  .jc-empty {
    padding: 20px;
    text-align: center;
    color: #9e9e9e;
    font-style: italic;
  }
</style>
</head>
<body>
<div class="jc-header">
  <h2>${h(pageTitle)}</h2>
  <div class="jc-meta">${
    testCounts ? `${h(totalTestsInfo)}` : ""
  }${coverage ? `${testCounts ? " &middot; " : ""}${coverage.perFile ? coverage.perFile.length : 0} file(s) tracked` : ""}</div>
</div>

${testBadgesHtml ? `<div class="jc-badges">${testBadgesHtml}</div>` : ""}

${
  coverageSummaryHtml
    ? `<div class="jc-cards">${coverageSummaryHtml}</div>`
    : ""
}

${
  coverage
    ? `<details class="jc-section"${coverage.perFile && coverage.perFile.length > 0 ? " open" : ""}>
  <summary class="jc-section-title">Coverage per File</summary>
  ${coverageTableHtml}
</details>`
    : ""
}

${
  suitesHtml
    ? `<details class="jc-section" open>
  <summary class="jc-section-title">Test Suites (${testResults.testResults.length})</summary>
  ${suitesHtml}
</details>`
    : ""
}

${
  !testCounts && !coverage
    ? '<div class="jc-empty">No test results or coverage data found.</div>'
    : ""
}
</body>
</html>`;
  },
};

// ===========================================================================
// Helpers
// ===========================================================================

/** Find and parse a JSON file at the root of reportDir. */
async function findAndParseJson(reportDir, filename) {
  const full = path.join(reportDir, filename);
  if (await fse.pathExists(full)) {
    try {
      const data = await fse.readJson(full);
      if (data && typeof data === "object") return data;
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

/**
 * Parse coverage data, preferring coverage-final.json (richest data)
 * with clover.xml as fallback. Returns null if neither is found.
 */
async function parseCoverage(reportDir) {
  // Try coverage-final.json first
  const finalPath = path.join(reportDir, "coverage-final.json");
  if (await fse.pathExists(finalPath)) {
    try {
      return await parseCoverageFinal(finalPath);
    } catch (err) {
      // fall through to clover.xml
    }
  }

  // Fall back to clover.xml
  const cloverPath = path.join(reportDir, "clover.xml");
  if (await fse.pathExists(cloverPath)) {
    try {
      return await parseCloverXml(cloverPath);
    } catch {
      return null;
    }
  }

  return null;
}

/** Parse coverage-final.json (Istanbul JSON format). */
async function parseCoverageFinal(filePath) {
  const data = await fse.readJson(filePath);
  const perFile = [];

  let totalStatements = 0;
  let hitStatements = 0;
  let totalBranches = 0;
  let hitBranches = 0;
  let totalFunctions = 0;
  let hitFunctions = 0;
  let totalLines = 0;
  let hitLines = 0;

  const fileEntries = Object.values(data).filter(
    (v) => v && typeof v === "object" && v.statementMap,
  );

  for (const f of fileEntries) {
    const stmtIds = Object.keys(f.statementMap);
    const stmtTotal = stmtIds.length;
    let stmtHit = 0;
    if (f.s) {
      for (const id of stmtIds) {
        if ((f.s[id] || 0) > 0) stmtHit++;
      }
    }
    totalStatements += stmtTotal;
    hitStatements += stmtHit;

    // Functions
    const fnIds = Object.keys(f.fnMap || {});
    const fnTotal = fnIds.length;
    let fnHit = 0;
    if (f.f) {
      for (const id of fnIds) {
        if ((f.f[id] || 0) > 0) fnHit++;
      }
    }
    totalFunctions += fnTotal;
    hitFunctions += fnHit;

    // Branches
    let brTotal = 0;
    let brHit = 0;
    if (f.branchMap && f.b) {
      for (const [brId, brMap] of Object.entries(f.branchMap)) {
        const locs = brMap.locations || [];
        const brHits = f.b[brId] || [];
        for (let i = 0; i < locs.length; i++) {
          brTotal++;
          if ((brHits[i] || 0) > 0) brHit++;
        }
      }
    }
    totalBranches += brTotal;
    hitBranches += brHit;

    // Lines — unique line numbers from statementMap
    const lineHits = {};
    for (const id of stmtIds) {
      const line = f.statementMap[id].start.line;
      if (!(line in lineHits)) lineHits[line] = 0;
      if (f.s && (f.s[id] || 0) > 0)
        lineHits[line] = Math.max(lineHits[line], f.s[id]);
    }
    const uniqueLines = Object.keys(lineHits).length;
    const hitUniqueLines = Object.values(lineHits).filter((c) => c > 0).length;
    totalLines += uniqueLines;
    hitLines += hitUniqueLines;

    // Per-file record
    const displayName = f.path || "unknown";
    perFile.push({
      name: displayName,
      statements:
        stmtTotal > 0 ? Math.round((stmtHit / stmtTotal) * 100 * 10) / 10 : 0,
      branches: brTotal > 0 ? Math.round((brHit / brTotal) * 100 * 10) / 10 : 0,
      functions:
        fnTotal > 0 ? Math.round((fnHit / fnTotal) * 100 * 10) / 10 : 0,
      lines:
        uniqueLines > 0
          ? Math.round((hitUniqueLines / uniqueLines) * 100 * 10) / 10
          : 0,
    });
  }

  return {
    entrypoint: "coverage-final.json",
    statements:
      totalStatements > 0
        ? Math.round((hitStatements / totalStatements) * 100 * 10) / 10
        : 0,
    branches:
      totalBranches > 0
        ? Math.round((hitBranches / totalBranches) * 100 * 10) / 10
        : 0,
    functions:
      totalFunctions > 0
        ? Math.round((hitFunctions / totalFunctions) * 100 * 10) / 10
        : 0,
    lines:
      totalLines > 0 ? Math.round((hitLines / totalLines) * 100 * 10) / 10 : 0,
    perFile,
  };
}

/** Parse clover.xml for aggregate coverage numbers (fallback). */
async function parseCloverXml(filePath) {
  const content = await fse.readFile(filePath, "utf8");

  // Extract project-level <metrics ... /> element
  const metricsMatch = content.match(
    /<metrics\s[^>]*?statements="(\d+)"[^>]*?coveredstatements="(\d+)"[^>]*?conditionals="(\d+)"[^>]*?coveredconditionals="(\d+)"[^>]*?methods="(\d+)"[^>]*?coveredmethods="(\d+)"[^>]*?\/>/,
  );

  if (!metricsMatch) {
    return null;
  }

  const totalStatements = Number(metricsMatch[1]);
  const coveredStatements = Number(metricsMatch[2]);
  const totalConditionals = Number(metricsMatch[3]);
  const coveredConditionals = Number(metricsMatch[4]);
  const totalMethods = Number(metricsMatch[5]);
  const coveredMethods = Number(metricsMatch[6]);

  return {
    entrypoint: "clover.xml",
    statements:
      totalStatements > 0
        ? Math.round((coveredStatements / totalStatements) * 100 * 10) / 10
        : 0,
    branches:
      totalConditionals > 0
        ? Math.round((coveredConditionals / totalConditionals) * 100 * 10) / 10
        : 0,
    functions:
      totalMethods > 0
        ? Math.round((coveredMethods / totalMethods) * 100 * 10) / 10
        : 0,
    lines:
      totalStatements > 0
        ? Math.round((coveredStatements / totalStatements) * 100 * 10) / 10
        : 0,
    perFile: [],
  };
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
