var wrapper = require('solc/wrapper');
var path = require('path');
var fs = require('fs-extra');
var homedir = require('homedir');
var downloader = require("../downloader");

var supportedVersions = [
  '0.4.25', '0.5.4',
];

function getWrapper(options = {}) {

  let compilerVersion = '0.5.4';
  let solcDir = path.join(homedir(), '.mcashbox', 'solc');

  if (options.networks) {
    if (options.networks.useZeroFourCompiler) {
      compilerVersion = '0.4.25'
    } else if (options.networks.useZeroFiveCompiler) {
      compilerVersion = '0.5.4'
    }

    try {
      let version = options.networks.compilers.solc.version;
      if (supportedVersions.includes(version)) {
        compilerVersion = version
      } else {
        console.error(`Error: McashBox supports only the following versions: ${supportedVersions.join(', ')}`);
        process.exit();
      }
    } catch (e) {
    }
  }

  let soljsonPath = path.join(solcDir, `soljson_v${compilerVersion}.js`);

  if (!fs.existsSync(soljsonPath)) {
    let downloaded = false;
    downloader(compilerVersion).finally(() => {
      downloaded = true;
    });
    while (!downloaded) {
      require('deasync').sleep(1000);
    }
  }
  let soljson = eval('require')(soljsonPath);
  return wrapper(soljson)
}

module.exports.getWrapper = getWrapper;
module.exports.supportedVersions = supportedVersions;
