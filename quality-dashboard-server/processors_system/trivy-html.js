const fse = require('fs-extra');

module.exports = {
  analyse: async reportFolder => {
    console.log(`Analysing ${reportFolder} - test`);
    const reportFile = `${reportFolder}/report.html`;
    let content = (await fse.readFile(reportFile)).toString().replace(/\n/g, '');
    const nvCritital = (content.match(/\<td class="severity"\>CRITICAL\<\/td\>/g) || []).length;
    const nvHigh = (content.match(/\<td class="severity"\>HIGH\<\/td\>/g) || []).length;
    const nvMedium = (content.match(/\<td class="severity"\>MEDIUM\<\/td\>/g) || []).length;
    const nvLow = (content.match(/\<td class="severity"\>LOW\<\/td\>/g) || []).length;
    return {
      link: 'report.html',
      warning: Number(nvMedium) + Number(nvLow),
      error: Number(nvCritital) + Number(nvHigh)
    };
  }
};
