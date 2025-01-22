const fse = require('fs-extra');

module.exports = {
  analyse: async reportFolder => {
    console.log(`Analysing ${reportFolder}`);
    const reportFile = `${reportFolder}/coverage/lcov-report/index.html`;
    let content = (await fse.readFile(reportFile)).toString().replace(/\n/g, '');
    content = content.substring(0, content.indexOf('Branches'));
    const regexCoverage = /.*?(\d+\.?\d+?)%.*?Statements/;
    const coverage = `${content.match(regexCoverage)[1]}%`;
    return {
      link: 'coverage/lcov-report/index.html',
      coverage
    };
  }
};
