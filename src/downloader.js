const path = require('path');
const fs = require('fs-extra');
const homedir = require('homedir');
const semver = require("semver");
const request = require("request-promise");

const URL = 'https://raw.githubusercontent.com/MidasCore/mcash-solc-bin/master';

async function getSolcVersions() {
    return request(URL + "/list.json")
    .then(list => {
      return JSON.parse(list);
    })
    .catch(error => {
        throw new Error(
        "Failed to complete request to: version URLs. Are you connected to the internet?\n\n" +
        error);
    });
}

function getSolcVersionFileName(version, allVersions) {
  if (allVersions.releases[version]) return allVersions.releases[version];
  return null;
}

function findNewestValidVersion(version, allVersions) {
  if (!semver.validRange(version)) return null;
  const satisfyingVersions = Object.keys(allVersions.releases)
    .map(solcVersion => {
      if (semver.satisfies(solcVersion, version)) return solcVersion;
    })
    .filter(solcVersion => solcVersion);
  if (satisfyingVersions.length > 0) {
    return satisfyingVersions.reduce((newestVersion, version) => {
      return semver.gtr(version, newestVersion) ? version : newestVersion;
    }, "0.0.0");
  } else {
    return null;
  }
}


async function downloader(compilerVersion) {
  console.log("Downloading soljson...");
  let dir = path.join(homedir(), '.mcashbox', 'solc');
  let soljsonPath = path.join(dir, `soljson_v${compilerVersion}.js`);

  await fs.ensureDir(path.join(dir));

  let allVersions, versionToUse;

  try {
    allVersions = await getSolcVersions();
  } catch (error) {
    throw new Error("Failed to complete request to: " +
        compilerVersion +
        ". Are you connected to the internet?\n\n" +
        error);
  }

  const isVersionRange = !semver.valid(compilerVersion);

  versionToUse = isVersionRange
    ? findNewestValidVersion(compilerVersion, allVersions)
    : compilerVersion;


  const fileName = getSolcVersionFileName(versionToUse, allVersions);
  if (!fileName)
    throw new Error(`Could not find a compiler version matching ${versionToUse}. ` +
        `Please ensure you are specifying a valid version, constraint or ` +
        `build in the truffle config.`,);


  let res = await request.get(`${URL}/bin/${fileName}`);
  if (res) {
    await fs.writeFile(soljsonPath, res)
  } else {
    console.log('Error. Wrong Solidity compiler version.')
  }
}

module.exports = downloader;
