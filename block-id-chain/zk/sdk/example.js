const fs = require("fs");
const path = require("path");
const { verifier, prover, utils } = require("./index");
const { hashSignals } = utils;


const circuitPath = path.join(__dirname, "../artifacts/circuits/BasicIdentity/");
const circuitWasmFilePath = circuitPath + "BasicIdentity_js/BasicIdentity.wasm";
const outputWitnessFilePath = circuitPath + "BasicIdentity_js/BasicIdentity.wtns";
const zkeyFilePath = circuitPath + "BasicIdentity.zkey";
const vkeyFilePath = circuitPath + "BasicIdentity.vkey";
const outputProofFilePath = circuitPath + "BasicIdentity_js/BasicIdentity.proof.json";
const outputPublicSignalsFilePath = circuitPath + "BasicIdentity_js/BasicIdentity.proof.ps.json";

async function runExample() {
  // Prepare input for witness generation.
  console.log("Preparing input for witness generation...");
  const input = {
    client_id_and_full_name: hashSignals("client_id_1", "toprak keskin"),
    identity_number_and_nationality: hashSignals("12345678910", "TC"),
    date_of_birth_padded: hashSignals("05.06.1995", "0"),
  };

  // Generate witness.
  console.log("Generating witness...");
  await prover.generateWitness(input, circuitWasmFilePath, outputWitnessFilePath);

  // Generate proof and public signals.
  console.log("Generating proof and public signals...");
  const { proof, publicSignals } = await prover.prove(outputWitnessFilePath, zkeyFilePath, outputProofFilePath, outputPublicSignalsFilePath);
  // Save proof and public signals to files.
  fs.writeFileSync(outputProofFilePath, JSON.stringify(proof, null, 1));
  fs.writeFileSync(outputPublicSignalsFilePath, JSON.stringify(publicSignals, null, 1));

  // Verify proof.
  console.log("Verifying proof...")
  const vkey = JSON.parse(fs.readFileSync(vkeyFilePath).toString());
  const verified = verifier.verify(vkey, publicSignals, proof);
  if (!verified) {
    throw new Error("Proof is not verified!");
  }
  console.log("DONE!")
}

runExample().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
