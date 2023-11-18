const { createHash } = require("crypto");

const hash = function (data, algorithm = "sha512") {
  return createHash(algorithm)
    .update(data)
    .digest('hex').toString('utf8');
}

const multiHash = function ({ arr, algorithm = "sha512"}) {
  return createHash(algorithm)                 
    .update(arr.reduce((acc, val) => acc + hash(val, algorithm), ""))
    .digest('hex').toString('utf8');
}

const hashSignals = function (...signals) {
  const hash = multiHash({ arr: signals })
  return BigInt("0x" + hash.toString('hex'));
}

const hashSignal = function (signal) {
  const hash = hash(signal)
  return BigInt("0x" + hash.toString('hex'));
}

const getArtifactsPath = function () {
  return "node_modules/block-id-chain/zk/artifacts/";
}

module.exports = {
  hash,
  multiHash,
  hashSignals,
  hashSignal,
  getArtifactsPath
}