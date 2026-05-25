const fse = require("fs-extra");
const path = require("path");

module.exports = {
  describe: () => ({
    name: "trivy-html",
    accepts: ["html"],
    summary: "Counts vulnerabilities by severity from a Trivy HTML report",
  }),

  analyse: async ({ reportDir }) => {
    const reportFile = path.join(reportDir, "report.html");
    if (!(await fse.pathExists(reportFile))) {
      throw new Error("trivy-html: report.html not found");
    }
    const content = (await fse.readFile(reportFile))
      .toString()
      .replace(/\n/g, "");

    const critical = (
      content.match(/<td class="severity">CRITICAL<\/td>/g) || []
    ).length;
    const high = (content.match(/<td class="severity">HIGH<\/td>/g) || [])
      .length;
    const medium = (content.match(/<td class="severity">MEDIUM<\/td>/g) || [])
      .length;
    const low = (content.match(/<td class="severity">LOW<\/td>/g) || []).length;

    return {
      fileEntrypoint: "report.html",
      metrics: [
        { name: "trivy.critical", type: "count", value: critical },
        { name: "trivy.high", type: "count", value: high },
        { name: "trivy.medium", type: "count", value: medium },
        { name: "trivy.low", type: "count", value: low },
      ],
      info: { source: "trivy-html" },
    };
  },
};
