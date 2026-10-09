import { expect } from "chai";
import { PUBLIC_SIGNALS } from "../index.js";
import { IDENTITY, SALT, commitmentOf, makeInput, prove, proveAndCatch, verify } from "./helpers.js";

describe("IdentityProof circuit", () => {
  describe("a valid proof", () => {
    it("verifies, and the public signals are commitment, wallet, clientId, nonce", async () => {
      const input = makeInput();
      const { proof, publicSignals } = await prove(input);

      expect(await verify(publicSignals, proof)).to.equal(true);
      expect(publicSignals).to.deep.equal(
        PUBLIC_SIGNALS.map((name) => input[name].toString()),
      );
      expect(publicSignals[0]).to.equal(commitmentOf(IDENTITY, SALT).toString());
    });

    it("matches Poseidon(fullName, identityNumber, nationality, dateOfBirth, salt) computed in JS", async () => {
      // The circuit would refuse a commitment that differs from circomlib's Poseidon(5).
      // poseidon-lite is an independent implementation, so this ties the two together.
      const expected = commitmentOf(IDENTITY, SALT);
      const { publicSignals } = await prove(makeInput({ commitment: expected }));
      expect(publicSignals[0]).to.equal(expected.toString());
    });
  });

  describe("identity commitment", () => {
    it("is the same for the same data and salt, whatever the wallet, exchange or request", async () => {
      const a = await prove(makeInput({ wallet: 1n, clientId: 1n, nonce: 1n }));
      const b = await prove(makeInput({ wallet: 2n, clientId: 2n, nonce: 2n }));
      expect(a.publicSignals[0]).to.equal(b.publicSignals[0]);
      expect(a.publicSignals[1]).to.not.equal(b.publicSignals[1]);
    });

    for (const field of ["fullName", "identityNumber", "nationality", "dateOfBirth"]) {
      it(`changes when ${field} changes`, async () => {
        const changed = { ...IDENTITY, [field]: IDENTITY[field] + 1n };
        const { proof, publicSignals } = await prove(makeInput({ identity: changed }));
        expect(await verify(publicSignals, proof)).to.equal(true);
        expect(publicSignals[0]).to.not.equal(commitmentOf(IDENTITY, SALT).toString());
      });
    }

    it("changes when the salt changes", async () => {
      const { publicSignals } = await prove(makeInput({ salt: SALT + 1n }));
      expect(publicSignals[0]).to.not.equal(commitmentOf(IDENTITY, SALT).toString());
    });
  });

  describe("proving something false", () => {
    it("fails when the commitment does not match the private data", async () => {
      const wrong = commitmentOf(IDENTITY, SALT) + 1n;
      const error = await proveAndCatch(makeInput({ commitment: wrong }));
      expect(error, "witness generation should fail").to.be.an("error");
      expect(error.message).to.match(/Assert Failed/);
    });

    for (const field of ["fullName", "identityNumber", "nationality", "dateOfBirth", "salt"]) {
      it(`fails when ${field} is not the one in the commitment`, async () => {
        const input = makeInput();
        input[field] += 1n;
        const error = await proveAndCatch(input);
        expect(error, "witness generation should fail").to.be.an("error");
        expect(error.message).to.match(/Assert Failed/);
      });
    }
  });
});
