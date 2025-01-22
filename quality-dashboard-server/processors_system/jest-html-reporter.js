const fse = require('fs-extra');

module.exports = {
  analyse: async reportFolder => {
    console.log(`Analysing ${reportFolder}`);
    const reportFile = `${reportFolder}/report.html`;
    let content = (await fse.readFile(reportFile)).toString().replace(/\n/g, '');
    content = content.substring(content.indexOf('id="summary"'), content.indexOf('class="suite-info"'));
    const regexSummary = /.*?(\d+) tests.*?(\d+) passed.*?(\d+) failed.*?(\d+) pending/;
    const summary = content.match(regexSummary);
    return {
      link: 'report.html',
      success: Number(summary[2]),
      error: Number(summary[3]),
      total: Number(summary[1]) + Number(summary[4])
    };
  }
};
