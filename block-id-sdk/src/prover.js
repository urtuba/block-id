const snarkjs = require("snarkjs");

exports.generateWitness = async function (input, circuitWasmFilePath, outputWitnessFilePath) {
  await snarkjs.wtns.calculate(input, circuitWasmFilePath, outputWitnessFilePath);
};

exports.prove = async function (witnessFilePath, zkeyFilePath) {
  const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyFilePath, witnessFilePath);
  return { proof, publicSignals };
}

