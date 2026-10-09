import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import { poseidon5 } from "poseidon-lite";
import { artifactUrls } from "block-id-circuits";

const wasmPath = fileURLToPath(artifactUrls.wasm);
const zkeyPath = fileURLToPath(artifactUrls.zkey);

// Identity fields as field elements. The protocol hashes text into the field; the contract
// and the circuit only see numbers, so small ones are enough here.
export const ALICE_ID = { fullName: 11n, identityNumber: 22n, nationality: 33n, dateOfBirth: 44n };
export const OTHER_ID = { ...ALICE_ID, identityNumber: 23n };
export const SALT = 555n;

export const commitmentOf = (identity, salt = SALT) =>
  poseidon5([identity.fullName, identity.identityNumber, identity.nationality, identity.dateOfBirth, salt]);

// snarkjs starts worker threads for proving and verifying. Without this the process never
// exits after the last test. A root hook: it runs once, after every test file.
after(async () => {
  await globalThis.curve_bn128?.terminate();
});

const cache = new Map();

/**
 * A real Groth16 proof from the committed circuit, in the shape BlockID.recordSync takes:
 * { pA, pB, pC, pubSignals }. Proofs are cached because proving takes ~100 ms.
 */
export async function makeProof({ identity = ALICE_ID, salt = SALT, wallet, clientId, nonce }) {
  const input = {
    ...Object.fromEntries(Object.entries({ ...identity, salt }).map(([k, v]) => [k, v.toString()])),
    identityCommitment: commitmentOf(identity, salt).toString(),
    wallet: BigInt(wallet).toString(),
    clientId: BigInt(clientId).toString(),
    nonce: BigInt(nonce).toString(),
  };
  const key = JSON.stringify(input);
  if (!cache.has(key)) {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    // exportSolidityCallData prints the four verifier arguments as a JSON-like list.
    const call = JSON.parse(`[${await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)}]`);
    const [pA, pB, pC, pubSignals] = call;
    cache.set(key, { pA, pB, pC, pubSignals });
  }
  return structuredClone(cache.get(key));
}
