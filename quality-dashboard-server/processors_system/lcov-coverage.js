const fse = require("fs-extra");
const path = require("path");

module.exports = {
  describe: () => ({
    name: "lcov-coverage",
    accepts: ["tar.gz", "zip"],
    summary: "Extracts statement coverage percentage from lcov HTML output",
  }),

  analyse: async ({ reportDir }) => {
    const candidates = [
      "coverage/lcov-report/index.html",
      "lcov-report/index.html",
      "index.html",
    ];
    let reportFile = null;
    let entrypoint = null;
    for (const rel of candidates) {
      const full = path.join(reportDir, rel);
      if (await fse.pathExists(full)) {
        reportFile = full;
        entrypoint = rel;
        break;
      }
    }
    if (!reportFile) {
      throw new Error("lcov-coverage: no lcov-report/index.html found");
    }

    const raw = (await fse.readFile(reportFile)).toString().replace(/\n/g, "");
    const segment = raw.substring(0, raw.indexOf("Branches"));
    const match = segment.match(/.*?(\d+(?:\.\d+)?)%.*?Statements/);
    if (!match) {
      throw new Error("lcov-coverage: statement coverage not found");
    }
    const coverage = Number(match[1]);

    return {
      fileEntrypoint: entrypoint,
      metrics: [
        { name: "coverage.statements", type: "percentage", value: coverage },
      ],
      info: { source: "lcov-coverage" },
    };
  },
};
