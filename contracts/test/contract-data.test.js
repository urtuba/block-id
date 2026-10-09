import { expect } from "chai";
import hre from "hardhat";
import * as contractData from "../contract-data.js";

// The protocol tests and the browser demo deploy the contracts from contract-data.js.
// This keeps that file in step with the Hardhat build.
describe("contract-data.js", () => {
  const hint = "contract-data.js is out of date. Run: npm run export-contract -w contracts";
  let blockId, verifier;

  before(async () => {
    blockId = await hre.artifacts.readArtifact("BlockID");
    verifier = await hre.artifacts.readArtifact("Groth16Verifier");
  });

  it("has the ABI and creation bytecode of BlockID", () => {
    expect(contractData.blockIdAbi, hint).to.deep.equal(blockId.abi);
    expect(contractData.blockIdBytecode, hint).to.equal(blockId.bytecode);
  });

  it("has the ABI and creation bytecode of the generated verifier", () => {
    expect(contractData.verifierAbi, hint).to.deep.equal(verifier.abi);
    expect(contractData.verifierBytecode, hint).to.equal(verifier.bytecode);
  });
});
