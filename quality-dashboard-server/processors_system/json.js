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
};
