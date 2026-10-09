import { expect } from "chai";
import hre from "hardhat";
import { makeProof } from "./helpers.js";

// The generated verifier on its own: it must accept a real proof and nothing else.
describe("IdentityProofVerifier (generated Groth16Verifier)", () => {
  let verifier, proof;
  const wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  before(async () => {
    const { ethers } = await hre.network.create();
    verifier = await ethers.deployContract("Groth16Verifier");
    proof = await makeProof({ wallet, clientId: 1, nonce: 1 });
  });

  const verify = (p) => verifier.verifyProof(p.pA, p.pB, p.pC, p.pubSignals);

  it("accepts a valid proof", async () => {
    expect(await verify(proof)).to.equal(true);
  });

  it("has four public signals: commitment, wallet, clientId, nonce", () => {
    expect(proof.pubSignals).to.have.length(4);
    expect(BigInt(proof.pubSignals[1])).to.equal(BigInt(wallet));
    expect(BigInt(proof.pubSignals[2])).to.equal(1n);
    expect(BigInt(proof.pubSignals[3])).to.equal(1n);
  });

  ["commitment", "wallet", "clientId", "nonce"].forEach((name, index) => {
    it(`rejects the proof when the ${name} public signal is changed`, async () => {
      const tampered = structuredClone(proof);
      tampered.pubSignals[index] = (BigInt(tampered.pubSignals[index]) + 1n).toString();
      expect(await verify(tampered)).to.equal(false);
    });
  });

  it("rejects a proof with a changed pA", async () => {
    const tampered = structuredClone(proof);
    // another valid curve point: the proof's own pC
    tampered.pA = [...tampered.pC];
    expect(await verify(tampered)).to.equal(false);
  });

  it("rejects a public signal that is not a field element (r + commitment)", async () => {
    const r = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const tampered = structuredClone(proof);
    tampered.pubSignals[0] = (BigInt(tampered.pubSignals[0]) + r).toString();
    expect(await verify(tampered)).to.equal(false);
  });
});
