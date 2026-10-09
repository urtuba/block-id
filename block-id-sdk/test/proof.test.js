import { expect } from "chai";
import * as snarkjs from "snarkjs";
import {
  identityCommitment,
  parsePublicSignals,
  proofToCalldata,
  proveIdentity,
  verifyIdentityProof,
} from "../src/index.js";
import { ALICE, BOB, IDENTITY, artifacts, expectError, vkey } from "./helpers.js";

const SALT = 123456789n;

describe("identity commitment", () => {
  const base = identityCommitment(IDENTITY, SALT);

  it("is the same for the same data and salt", () => {
    expect(identityCommitment({ ...IDENTITY }, SALT)).to.equal(base);
  });

  it("is the same when only case and spacing differ", () => {
    expect(identityCommitment({ ...IDENTITY, fullName: "ADA  LOVELACE" }, SALT)).to.equal(base);
  });

  for (const [field, other] of [
    ["fullName", "Ada Byron"],
    ["identityNumber", "12345678902"],
    ["nationality", "FR"],
    ["dateOfBirth", "1990-12-11"],
  ]) {
    it(`changes when ${field} changes`, () => {
      expect(identityCommitment({ ...IDENTITY, [field]: other }, SALT)).to.not.equal(base);
    });
  }

  it("changes when the salt changes", () => {
    expect(identityCommitment(IDENTITY, SALT + 1n)).to.not.equal(base);
  });

  it("rejects a zero or oversized salt", async () => {
    await expectError("INVALID_INPUT", () => identityCommitment(IDENTITY, 0n));
    await expectError("INVALID_INPUT", () => identityCommitment(IDENTITY, 2n ** 254n));
    await expectError("INVALID_INPUT", () => identityCommitment(IDENTITY, "abc"));
  });
});

describe("proveIdentity / verifyIdentityProof", () => {
  let proved;
  before(async () => {
    proved = await proveIdentity({ identity: IDENTITY, salt: SALT, wallet: ALICE, clientId: 2, nonce: 7, artifacts });
  });

  it("makes a proof whose public signals are commitment, wallet, client id and nonce", async () => {
    expect(await verifyIdentityProof(vkey, proved)).to.equal(true);
    expect(parsePublicSignals(proved.publicSignals)).to.deep.equal({
      identityCommitment: identityCommitment(IDENTITY, SALT),
      wallet: ALICE.toLowerCase(),
      clientId: 2,
      nonce: 7,
    });
  });

  it("two exchanges with the same data and salt make the same commitment", async () => {
    const other = await proveIdentity({ identity: IDENTITY, salt: SALT, wallet: ALICE, clientId: 1, nonce: 7, artifacts });
    expect(other.publicSignals[0]).to.equal(proved.publicSignals[0]);
    expect(other.publicSignals[2]).to.not.equal(proved.publicSignals[2]);
  });

  it("another identity gives another commitment", async () => {
    const other = await proveIdentity({ identity: { ...IDENTITY, identityNumber: "999" }, salt: SALT, wallet: ALICE, clientId: 2, nonce: 7, artifacts });
    expect(other.publicSignals[0]).to.not.equal(proved.publicSignals[0]);
  });

  for (const [index, name] of ["identityCommitment", "wallet", "clientId", "nonce"].entries()) {
    it(`does not verify when ${name} is changed`, async () => {
      const publicSignals = [...proved.publicSignals];
      publicSignals[index] = (BigInt(publicSignals[index]) + 1n).toString();
      expect(await verifyIdentityProof(vkey, { proof: proved.proof, publicSignals })).to.equal(false);
    });
  }

  it("returns false, not an exception, for malformed input", async () => {
    expect(await verifyIdentityProof(vkey, { proof: proved.proof, publicSignals: proved.publicSignals.slice(1) })).to.equal(false);
    expect(await verifyIdentityProof(vkey, { proof: proved.proof, publicSignals: [...proved.publicSignals, "1"] })).to.equal(false);
    expect(await verifyIdentityProof(vkey, { proof: {}, publicSignals: proved.publicSignals })).to.equal(false);
    expect(await verifyIdentityProof(vkey, { proof: proved.proof, publicSignals: undefined })).to.equal(false);
  });

  it("does not verify a proof of one wallet for another wallet", async () => {
    const publicSignals = [...proved.publicSignals];
    publicSignals[1] = BigInt(BOB).toString();
    expect(await verifyIdentityProof(vkey, { proof: proved.proof, publicSignals })).to.equal(false);
  });

  it("rejects bad inputs before proving", async () => {
    await expectError("INVALID_INPUT", () => proveIdentity({ identity: IDENTITY, salt: SALT, wallet: "0x12", clientId: 1, nonce: 1, artifacts }));
    await expectError("INVALID_INPUT", () => proveIdentity({ identity: IDENTITY, salt: SALT, wallet: ALICE, clientId: 0, nonce: 1, artifacts }));
    await expectError("INVALID_INPUT", () => proveIdentity({ identity: IDENTITY, salt: SALT, wallet: ALICE, clientId: 1, nonce: -1, artifacts }));
    await expectError("INVALID_INPUT", () => proveIdentity({ identity: { ...IDENTITY, dateOfBirth: "tomorrow" }, salt: SALT, wallet: ALICE, clientId: 1, nonce: 1, artifacts }));
  });

  it("parsePublicSignals rejects a wrong number of signals", async () => {
    await expectError("PROOF_BINDING", () => parsePublicSignals(["1", "2", "3"]));
  });

  it("proofToCalldata gives the arguments snarkjs' own Solidity export gives", async () => {
    const expected = JSON.parse(`[${await snarkjs.groth16.exportSolidityCallData(proved.proof, proved.publicSignals)}]`);
    const { pA, pB, pC, pubSignals } = proofToCalldata(proved);
    const asNumbers = (value) => (Array.isArray(value) ? value.map(asNumbers) : BigInt(value));
    expect(asNumbers([pA, pB, pC, pubSignals])).to.deep.equal(asNumbers(expected));
  });
});
