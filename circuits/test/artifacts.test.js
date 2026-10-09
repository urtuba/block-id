import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { expect } from "chai";
import * as snarkjs from "snarkjs";
import { PTAU_BLAKE2B, PTAU_FILE, PTAU_POWER, PTAU_URL } from "../scripts/ptau.mjs";
import { vkey, zkeyPath } from "./helpers.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("committed artifacts", () => {
  it("vkey.json is the verification key of the committed zkey", async () => {
    expect(await snarkjs.zKey.exportVerificationKey(zkeyPath)).to.deep.equal(vkey);
  });

  it("the Solidity verifier contains the verification key of the committed zkey", () => {
    const source = readFileSync(join(here, "..", "..", "contracts", "contracts", "IdentityProofVerifier.sol"), "utf8");
    const numbers = [
      vkey.vk_alpha_1.slice(0, 2),
      vkey.vk_beta_2.slice(0, 2).flat(),
      vkey.vk_gamma_2.slice(0, 2).flat(),
      vkey.vk_delta_2.slice(0, 2).flat(),
      vkey.IC.flatMap((point) => point.slice(0, 2)),
    ].flat();
    expect(numbers).to.have.length(2 + 4 + 4 + 4 + 2 * (vkey.nPublic + 1));
    for (const n of numbers) expect(source, `missing ${n}`).to.include(n);
    expect(source).to.include(`uint[${vkey.nPublic}] calldata _pubSignals`);
  });
});

describe("powers of tau file", () => {
  // snarkjs's README is the source of the hash. This reads the README of the snarkjs
  // version installed from npm and compares it with scripts/ptau.mjs.
  const require = createRequire(import.meta.url);
  const readme = readFileSync(join(dirname(require.resolve("snarkjs")), "..", "README.md"), "utf8");
  const row = readme.split("\n").find((line) => line.includes(`[${PTAU_FILE}]`));

  it("the hash in scripts/ptau.mjs is the one in the snarkjs README", () => {
    expect(row, `${PTAU_FILE} not found in the snarkjs README`).to.be.a("string");
    expect(row).to.include(`| ${PTAU_BLAKE2B} |`);
  });

  it("is the 2^9 file, the smallest that fits the circuit", () => {
    expect(PTAU_POWER).to.equal(9);
    expect(PTAU_FILE).to.equal("powersOfTau28_hez_final_09.ptau");
    expect(PTAU_URL.endsWith(`/${PTAU_FILE}`)).to.equal(true);
  });
});
