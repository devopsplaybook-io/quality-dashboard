/**
 * Generic JSON processor.
 *
 * Accepts a JSON payload (either inlined in the request as `meta.jsonPayload`
 * or stored in `<reportDir>/data.json`). The payload must already follow the
 * canonical processor result shape:
 *
 *   {
 *     "fileEntrypoint": "report.html",   // optional
 *     "metrics": [
 *       { "name": "...", "type": "count" | "percentage" | "duration" | "boolean", "value": 42 }
 *     ],
 *     "info": { ... }                    // optional
 *   }
 */
const fse = require("fs-extra");
const path = require("path");

module.exports = {
  describe: () => ({
    name: "json",
    accepts: ["json"],
    summary: "Pass-through processor for already-shaped metric payloads",
  }),

  analyse: async ({ reportDir, jsonPayload }) => {
    let payload = jsonPayload;
    if (!payload) {
      const file = path.join(reportDir, "data.json");
      if (await fse.pathExists(file)) {
        payload = await fse.readJson(file);
      }
    }
    if (!payload || typeof payload !== "object") {
      throw new Error("json: no JSON payload provided");
    }
    if (!Array.isArray(payload.metrics)) {
      throw new Error("json: payload must include a 'metrics' array");
    }
    return {
      fileEntrypoint: payload.fileEntrypoint,
      metrics: payload.metrics,
      info: payload.info || {},
    };
  },

  formatReportPreview: async ({ reportDir }) => {
    const file = path.join(reportDir, "data.json");
    if (!(await fse.pathExists(file))) {
      throw new Error("json: no data.json found in report directory");
    }
    const payload = await fse.readJson(file);

    const metrics = Array.isArray(payload.metrics) ? payload.metrics : [];
    const info = payload.info || {};
    const h = escapeHtml;

    // ── Metric type colours ────────────────────────────────────────────
    const typeColours = {
      count: { bg: "#1565c0" },
      percentage: { bg: "#6a1b9a" },
      duration: { bg: "#00838f" },
      boolean: { bg: "#2e7d32" },
    };

    const metricCards = metrics
      .map((m) => {
        const c = typeColours[m.type] || { bg: "#546e7a" };
        const displayValue =
          m.type === "percentage"
            ? `${m.value}%`
            : m.type === "duration"
              ? formatDuration(m.value)
              : m.type === "boolean"
                ? m.value
                  ? "Yes"
                  : "No"
                : String(m.value);
        return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;padding:8px 16px;border-radius:8px;background:${c.bg}1a;border:1px solid ${c.bg}44;min-width:110px">
  <span style="font-size:22px;font-weight:700;color:${c.bg}">${h(displayValue)}</span>
  <span style="font-size:11px;color:#9e9e9e;text-transform:uppercase;letter-spacing:0.5px">${h(m.name)}</span>
</div>`;
      })
      .join(" ");

    // ── Info table ─────────────────────────────────────────────────────
    let infoHtml = "";
    const infoEntries = collectLeafEntries(info);
    if (infoEntries.length > 0) {
      infoHtml = `<details class="jp-section" open>
  <summary class="jp-section-title">Info</summary>
  <table class="jp-table">
    <thead><tr><th>Key</th><th>Value</th></tr></thead>
    <tbody>${infoEntries
      .map(
        ([k, v]) =>
          `<tr><td style="font-family:monospace;white-space:nowrap">${h(k)}</td><td>${h(v)}</td></tr>`,
      )
      .join("")}</tbody>
  </table>
</details>`;
    }

    // ── Raw JSON ───────────────────────────────────────────────────────
    const rawJson = JSON.stringify(payload, null, 2);

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
  .jp-header { margin-bottom: 16px; }
  .jp-header h2 { margin: 0 0 4px; font-size: 18px; color: #e0e0e0; }
  .jp-header .jp-meta { font-size: 12px; color: #9e9e9e; }
  .jp-metrics { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .jp-empty {
    padding: 20px;
    text-align: center;
    color: #9e9e9e;
    font-style: italic;
  }
  .jp-section {
    border: 1px solid #333;
    border-radius: 8px;
    margin-bottom: 12px;
    background: #16213e;
    overflow: hidden;
  }
  .jp-section-title {
    padding: 10px 14px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    background: #0f3460;
    user-select: none;
  }
  .jp-section[open] .jp-section-title { border-bottom: 1px solid #333; }
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
  .jp-raw {
    padding: 14px;
    margin: 0;
    font-family: ui-monospace, "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
    background: #0d1b1e;
    color: #e0e0e0;
  }
</style>
</head>
<body>
<div class="jp-header">
  <h2>JSON Report Preview</h2>
  <div class="jp-meta">${metrics.length} metrics${
    Object.keys(info).length > 0
      ? ` &middot; info has ${Object.keys(info).length} top-level key(s)`
      : ""
  }</div>
</div>
${
  metrics.length > 0
    ? `<div class="jp-metrics">${metricCards}</div>`
    : '<div class="jp-empty">No metrics.</div>'
}
${infoHtml}
<details class="jp-section">
  <summary class="jp-section-title">Raw JSON</summary>
  <pre class="jp-raw">${h(rawJson)}</pre>
</details>
</body>
</html>`;
  },
};

function escapeHtml(str) {
  if (typeof str !== "string") return str == null ? "" : String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Flatten a nested object into dot-separated key → value entries. */
function collectLeafEntries(obj, prefix = "") {
  const entries = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      entries.push(...collectLeafEntries(v, key));
    } else {
      entries.push([key, Array.isArray(v) ? JSON.stringify(v) : String(v)]);
    }
  }
  return entries;
}

/** Format a numeric value (milliseconds) into a human-friendly duration. */
function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) {
    const s = ms / 1000;
    return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  }
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
