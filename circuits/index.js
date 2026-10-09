// Where the committed circuit artifacts are, and what the circuit's signals are.
// URLs (not file paths), so the same import works in Node and in a browser. In Node,
// pass `fileURLToPath(url)` to snarkjs.

/** Private inputs, as named in identity-proof.circom. */
export const PRIVATE_INPUTS = ["fullName", "identityNumber", "nationality", "dateOfBirth", "salt"];

/** Public signals in the order snarkjs and the Solidity verifier use. */
export const PUBLIC_SIGNALS = ["identityCommitment", "wallet", "clientId", "nonce"];

export const artifactUrls = {
  wasm: new URL("./artifacts/identity-proof.wasm", import.meta.url),
  zkey: new URL("./artifacts/identity-proof.zkey", import.meta.url),
  vkey: new URL("./artifacts/vkey.json", import.meta.url),
};
