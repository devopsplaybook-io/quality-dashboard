const fse = require('fs-extra');

module.exports = {
  analyse: async reportFolder => {
    console.log(`Analysing ${reportFolder}`);
    return await fse.readJson(`${reportFolder}/data.json`);
  }
};
