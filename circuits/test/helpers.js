import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import { readR1cs } from "r1csfile";
import { poseidon5 } from "poseidon-lite";
import { artifactUrls } from "../index.js";

export const wasmPath = fileURLToPath(artifactUrls.wasm);
export const zkeyPath = fileURLToPath(artifactUrls.zkey);
export const vkey = JSON.parse(readFileSync(artifactUrls.vkey, "utf8"));

// Field elements standing for an identity. In the protocol they are SHA-256 hashes of
// the text fields; the circuit only sees numbers, so small ones are enough here.
export const IDENTITY = {
  fullName: 1111111111n,
  identityNumber: 2222222222n,
  nationality: 3333333333n,
  dateOfBirth: 4444444444n,
};
export const SALT = 5555555555n;

export const commitmentOf = (identity, salt) =>
  poseidon5([identity.fullName, identity.identityNumber, identity.nationality, identity.dateOfBirth, salt]);

/** Circuit input for an identity, salt and the public binding values. */
export function makeInput({ identity = IDENTITY, salt = SALT, wallet = 0xabcdef0123456789n, clientId = 1n, nonce = 7n, commitment } = {}) {
  return {
    fullName: identity.fullName,
    identityNumber: identity.identityNumber,
    nationality: identity.nationality,
    dateOfBirth: identity.dateOfBirth,
    salt,
    identityCommitment: commitment ?? commitmentOf(identity, salt),
    wallet,
    clientId,
    nonce,
  };
}

export async function prove(input) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v.toString()])),
    wasmPath,
    zkeyPath,
  );
  return { proof, publicSignals };
}

export const verify = (publicSignals, proof) => snarkjs.groth16.verify(vkey, publicSignals, proof);

/** A G1 point at infinity in a snarkjs verification key has z = 0. */
export const isInfinity = (point) => point[2] === "0";

/** Indexes (0-based, in public signal order) of public inputs the verification key ignores. */
export const unboundPublicSignals = (key) =>
  key.IC.slice(1).flatMap((point, i) => (isInfinity(point) ? [i] : []));

/** Try to prove an input and return the error. The circuit runtime logs failed asserts; keep that quiet. */
export async function proveAndCatch(input) {
  const { log, error: logError } = console;
  console.log = console.error = () => {};
  try {
    await prove(input);
    return undefined;
  } catch (e) {
    return e;
  } finally {
    console.log = log;
    console.error = logError;
  }
}

export const r1csPath = fileURLToPath(new URL("../artifacts/identity-proof.r1cs", import.meta.url));
export const loadR1cs = () => readR1cs(r1csPath, true, false, false);

/**
 * Names of the wires 1..n (outputs, public inputs, private inputs; wire 0 is the
 * constant 1) that appear in no constraint at all. For a public input this is the
 * "unconstrained public signal" bug. `r1cs` is what r1csfile returns.
 */
export function wiresWithoutConstraint(r1cs) {
  const used = new Set();
  for (const constraint of r1cs.constraints) {
    for (const linearCombination of constraint) {
      for (const [wire, coefficient] of Object.entries(linearCombination)) {
        if (coefficient !== 0n) used.add(Number(wire));
      }
    }
  }
  const inputs = r1cs.nOutputs + r1cs.nPubInputs + r1cs.nPrvInputs;
  return Array.from({ length: inputs }, (_, i) => i + 1).filter((wire) => !used.has(wire));
}
