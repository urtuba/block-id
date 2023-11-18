
const snarkjs = require("snarkjs");

exports.generateWitness = async function (input, circuitWasmFilePath, outputWitnessFilePath) {
  await snarkjs.wtns.calculate(input, circuitWasmFilePath, outputWitnessFilePath);
};

exports.verify = async function (vkey, publicSignals, proof) {
  return await snarkjs.groth16.verify(vkey, publicSignals, proof)
}

