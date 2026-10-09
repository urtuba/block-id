// The BlockID protocol as one ES module. Works in Node and in the browser: it uses no
// Express, no database and no file system. See node.js for the Node-only helpers.
export { BlockIdError } from "./errors.js";
export {
  FIELD_PRIME,
  IDENTITY_FIELDS,
  SALT_MESSAGE,
  deriveSalt,
  encodeDate,
  encodeIdentity,
  encodeText,
  fieldToWallet,
  normalizeAddress,
  normalizeText,
  randomSalt,
  walletToField,
} from "./field.js";
export { identityCommitment } from "./commitment.js";
export { PUBLIC_SIGNALS, parsePublicSignals, proofToCalldata, proveIdentity, terminateProver, verifyIdentityProof } from "./proof.js";
export { Exchange } from "./exchange.js";
export { Orchestrator } from "./orchestrator.js";
export { createChain } from "./chain.js";
export { MemoryNetwork } from "./memory.js";
