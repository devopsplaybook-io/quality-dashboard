const fse = require("fs-extra");
const path = require("path");

module.exports = {
  describe: () => ({
    name: "popeye-html",
    accepts: ["html"],
    summary: "Parses Popeye HTML scorer output into severity counts",
  }),

  analyse: async ({ reportDir }) => {
    const reportFile = path.join(reportDir, "report.html");
    if (!(await fse.pathExists(reportFile))) {
      throw new Error("popeye-html: report.html not found");
    }
    const content = (await fse.readFile(reportFile))
      .toString()
      .replace(/\n/g, "");

    const totalCritical = countFindingsScore(
      content.match(/scorer level-3.*?(\d+).*?<\/span>/g),
    );
    const totalWarning = countFindingsScore(
      content.match(/scorer level-2.*?(\d+).*?<\/span>/g),
    );
    const totalInfo = countFindingsScore(
      content.match(/scorer level-1.*?(\d+).*?<\/span>/g),
    );
    const totalOK = countFindingsScore(
      content.match(/scorer level-0.*?(\d+).*?<\/span>/g),
    );

    return {
      fileEntrypoint: "report.html",
      metrics: [
        { name: "popeye.ok", type: "count", value: totalOK },
        { name: "popeye.info", type: "count", value: totalInfo },
        { name: "popeye.warning", type: "count", value: totalWarning },
        { name: "popeye.critical", type: "count", value: totalCritical },
      ],
      info: { source: "popeye-html" },
    };
  },
};

function countFindingsScore(findings) {
  if (!findings) {
    return 0;
  }
  let total = 0;
  for (const score of findings) {
    const m = score.match(/<\/i>.*?(\d+).*?<\/span>/);
    if (m) {
      total += Number(m[1]);
    }
  }
  return total;
}
