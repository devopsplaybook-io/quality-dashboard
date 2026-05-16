const fse = require("fs-extra");
const path = require("path");

module.exports = {
  describe: () => ({
    name: "jest-html-reporter",
    accepts: ["html"],
    summary: "Parses HTML output from jest-html-reporter into count metrics",
  }),

  analyse: async ({ reportDir }) => {
    const candidates = ["report.html", "test-report.html", "index.html"];
    let reportFile = null;
    for (const c of candidates) {
      const full = path.join(reportDir, c);
      if (await fse.pathExists(full)) {
        reportFile = full;
        break;
      }
    }
    if (!reportFile) {
      throw new Error("jest-html-reporter: no report HTML file found");
    }

    const content = (await fse.readFile(reportFile))
      .toString()
      .replace(/\n/g, "");
    const segment = content.substring(
      content.indexOf('id="summary"'),
      content.indexOf('class="suite-info"'),
    );
    const match = segment.match(
      /.*?(\d+) tests.*?(\d+) passed.*?(\d+) failed.*?(\d+) pending/,
    );
    if (!match) {
      throw new Error("jest-html-reporter: summary block not parsed");
    }

    const total = Number(match[1]);
    const passed = Number(match[2]);
    const failed = Number(match[3]);
    const pending = Number(match[4]);

    return {
      fileEntrypoint: path.basename(reportFile),
      metrics: [
        { name: "tests.total", type: "count", value: total + pending },
        { name: "tests.passed", type: "count", value: passed },
        { name: "tests.failed", type: "count", value: failed },
        { name: "tests.pending", type: "count", value: pending },
      ],
      info: { source: "jest-html-reporter" },
    };
  },
};
