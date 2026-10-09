import { expect } from "chai";
import {
  FIELD_PRIME,
  deriveSalt,
  encodeDate,
  encodeIdentity,
  encodeText,
  fieldToWallet,
  normalizeAddress,
  normalizeText,
  randomSalt,
  walletToField,
} from "../src/index.js";
import { ALICE, IDENTITY, expectError } from "./helpers.js";

describe("field encoding", () => {
  describe("text", () => {
    it("is deterministic and inside the field", () => {
      const a = encodeText("fullName", "Ada Lovelace");
      expect(a).to.equal(encodeText("fullName", "Ada Lovelace"));
      expect(a >= 0n && a < FIELD_PRIME).to.equal(true);
    });

    it("ignores case, surrounding space and repeated spaces", () => {
      expect(encodeText("fullName", "  ADA   lovelace\t")).to.equal(encodeText("fullName", "Ada Lovelace"));
      expect(normalizeText("fullName", " ADA \n Lovelace ")).to.equal("ada lovelace");
    });

    it("treats composed and decomposed accents as the same text", () => {
      expect(encodeText("fullName", "José")).to.equal(encodeText("fullName", "José"));
    });

    it("keeps different texts, and the same text in different fields, apart", () => {
      expect(encodeText("fullName", "Ada Lovelace")).to.not.equal(encodeText("fullName", "Ada Lovelace "+"Jr"));
      expect(encodeText("fullName", "gb")).to.not.equal(encodeText("nationality", "gb"));
      expect(encodeText("identityNumber", "0123")).to.not.equal(encodeText("identityNumber", "123"));
    });

    it("rejects empty and non-string values", async () => {
      await expectError("INVALID_INPUT", () => encodeText("fullName", "   "));
      await expectError("INVALID_INPUT", () => encodeText("fullName", undefined));
      await expectError("INVALID_INPUT", () => encodeText("identityNumber", 12345));
    });
  });

  describe("date", () => {
    it("is YYYYMMDD", () => {
      expect(encodeDate("dateOfBirth", "1990-12-10")).to.equal(19901210n);
    });

    it("rejects malformed dates and dates that do not exist", async () => {
      for (const bad of ["1990-13-01", "1990-02-30", "10/12/1990", "1990-1-1", "", "1990-12-10T00:00:00Z", 19901210]) {
        await expectError("INVALID_INPUT", () => encodeDate("dateOfBirth", bad));
      }
    });

    it("accepts 29 February in a leap year only", async () => {
      expect(encodeDate("dateOfBirth", "2000-02-29")).to.equal(20000229n);
      await expectError("INVALID_INPUT", () => encodeDate("dateOfBirth", "1900-02-29"));
    });
  });

  describe("identity", () => {
    it("encodes the four fields under the circuit's input names", () => {
      const fields = encodeIdentity(IDENTITY);
      expect(Object.keys(fields)).to.deep.equal(["fullName", "identityNumber", "nationality", "dateOfBirth"]);
      expect(fields.dateOfBirth).to.equal(19901210n);
    });

    it("rejects a missing field", async () => {
      const { nationality, ...rest } = IDENTITY;
      await expectError("INVALID_INPUT", () => encodeIdentity(rest));
      await expectError("INVALID_INPUT", () => encodeIdentity(null));
    });
  });

  describe("wallet", () => {
    it("maps an address to a field element and back, in lower case", () => {
      expect(walletToField(ALICE)).to.equal(BigInt(ALICE));
      expect(fieldToWallet(walletToField(ALICE))).to.equal(ALICE.toLowerCase());
      expect(fieldToWallet(1n)).to.equal("0x" + "0".repeat(39) + "1");
    });

    it("rejects malformed addresses", async () => {
      for (const bad of ["", "0x123", ALICE.slice(2), ALICE + "00", "0xZZ" + ALICE.slice(4), null]) {
        await expectError("INVALID_INPUT", () => normalizeAddress(bad));
      }
    });
  });

  describe("salt", () => {
    const signature = "0x" + "ab".repeat(65);

    it("is derived deterministically from a signature, inside the field and not zero", () => {
      const salt = deriveSalt(signature);
      expect(salt).to.equal(deriveSalt(signature));
      expect(salt > 0n && salt < FIELD_PRIME).to.equal(true);
    });

    it("differs for another signature", () => {
      expect(deriveSalt(signature)).to.not.equal(deriveSalt("0x" + "cd".repeat(65)));
    });

    it("rejects something that is not a signature", async () => {
      await expectError("INVALID_INPUT", () => deriveSalt("0x1234"));
      await expectError("INVALID_INPUT", () => deriveSalt("hello"));
    });

    it("randomSalt gives different field elements", () => {
      const a = randomSalt();
      expect(a).to.not.equal(randomSalt());
      expect(a > 0n && a < FIELD_PRIME).to.equal(true);
    });
  });
});
