import * as snarkjs from "snarkjs";
import { identityCommitment, requireSalt } from "./commitment.js";
import { BlockIdError } from "./errors.js";
import { encodeIdentity, fieldToWallet, requireId, walletToField } from "./field.js";

// snarkjs creates its BN254 curve, and the worker threads behind it, on first use and keeps
// it in a global. Two first calls at the same time each create one; the loser is never
// reachable again, so terminateProver cannot stop it and a Node process never exits.
// Running prover and verifier calls one after another avoids that. Proving is CPU-bound
// anyway, so little is lost.
let queue = Promise.resolve();
const oneAtATime = (task) => {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
};

/** The public signals in circuit order. */
export const PUBLIC_SIGNALS = ["identityCommitment", "wallet", "clientId", "nonce"];

/**
 * Prove "I know the identity behind this commitment" for one wallet, one exchange and one
 * request. Runs the circuit in WebAssembly, in Node or in the browser.
 *
 * @param {object} args
 * @param {{fullName: string, identityNumber: string, nationality: string, dateOfBirth: string}} args.identity
 * @param {bigint|string} args.salt
 * @param {string} args.wallet   0x address of the user
 * @param {number} args.clientId id of the exchange making the proof
 * @param {number|bigint} args.nonce the request id
 * @param {{wasm: string|Uint8Array, zkey: string|Uint8Array}} args.artifacts what snarkjs accepts:
 *        a file path (Node), a URL (browser) or bytes
 * @returns {Promise<{proof: object, publicSignals: string[]}>} snarkjs' proof and public signals
 */
export async function proveIdentity({ identity, salt, wallet, clientId, nonce, artifacts }) {
  const fields = encodeIdentity(identity);
  const input = {
    ...fields,
    salt: requireSalt(salt),
    identityCommitment: identityCommitment(identity, salt),
    wallet: walletToField(wallet),
    clientId: requireId("clientId", clientId),
    nonce: requireId("nonce", nonce),
  };
  const asDecimal = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.toString()]));
  const { proof, publicSignals } = await oneAtATime(() =>
    snarkjs.groth16.fullProve(asDecimal, artifacts.wasm, artifacts.zkey),
  );
  return { proof, publicSignals };
}

/** Read the four public signals of an identity proof. Throws on a wrong count. */
export function parsePublicSignals(publicSignals) {
  if (!Array.isArray(publicSignals) || publicSignals.length !== PUBLIC_SIGNALS.length) {
    throw new BlockIdError("PROOF_BINDING", `expected ${PUBLIC_SIGNALS.length} public signals`);
  }
  const [commitment, wallet, clientId, nonce] = publicSignals.map((signal) => BigInt(signal));
  return { identityCommitment: commitment, wallet: fieldToWallet(wallet), clientId: Number(clientId), nonce: Number(nonce) };
}

/**
 * Verify a Groth16 proof against the verification key. Returns false (never throws) for a
 * proof that is wrong or malformed.
 */
export async function verifyIdentityProof(vkey, { proof, publicSignals }) {
  if (!Array.isArray(publicSignals) || publicSignals.length !== PUBLIC_SIGNALS.length) return false;
  try {
    return (await oneAtATime(() => snarkjs.groth16.verify(vkey, publicSignals, proof))) === true;
  } catch {
    return false;
  }
}

/**
 * A snarkjs proof as the arguments of BlockID.recordSync (one IdentityProof struct).
 * G2 coordinates are swapped, as the Solidity verifier expects. Values are decimal strings.
 */
export function proofToCalldata({ proof, publicSignals }) {
  const { pi_a: a, pi_b: b, pi_c: c } = proof;
  return {
    pA: [a[0], a[1]],
    pB: [
      [b[0][1], b[0][0]],
      [b[1][1], b[1][0]],
    ],
    pC: [c[0], c[1]],
    pubSignals: publicSignals.map(String),
  };
}

/** Stop snarkjs' worker threads so a Node process can exit. Call it when you are done proving. */
export async function terminateProver() {
  await globalThis.curve_bn128?.terminate();
}
