const fse = require('fs-extra');

module.exports = {
  analyse: async reportFolder => {
    console.log(`Analysing ${reportFolder} - test`);
    const reportFile = `${reportFolder}/report.html`;
    let content = (await fse.readFile(reportFile)).toString().replace(/\n/g, '');
    let totalCritical = countFindingsScore(content.match(/scorer level-3.*?(\d+).*?\<\/span\>/g));
    let totalWarning = countFindingsScore(content.match(/scorer level-2.*?(\d+).*?\<\/span\>/g));
    let totalInfo = countFindingsScore(content.match(/scorer level-1.*?(\d+).*?\<\/span\>/g));
    let totalOK = countFindingsScore(content.match(/scorer level-1.*?(\d+).*?\<\/span\>/g));
    return {
      link: 'report.html',
      success: totalInfo + totalOK,
      warning: totalWarning,
      error: totalCritical
    };
  }
};

function countFindingsScore(findings) {
  let total = 0;
  for (const score of findings) {
    total += Number(score.match(/\<\/i\>.*?(\d+).*?\<\/span\>/)[1]);
  }
  return total;
}