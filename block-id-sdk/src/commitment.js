import { poseidon5 } from "poseidon-lite/poseidon5";
import { BlockIdError } from "./errors.js";
import { FIELD_PRIME, encodeIdentity } from "./field.js";

/** Check that a salt is a field element in [1, p). Accepts bigint or a decimal/0x string. */
export function requireSalt(salt) {
  let value;
  try {
    value = BigInt(salt);
  } catch {
    throw new BlockIdError("INVALID_INPUT", "salt must be a bigint or an integer string");
  }
  if (value <= 0n || value >= FIELD_PRIME) {
    throw new BlockIdError("INVALID_INPUT", "salt must be a field element in [1, p)");
  }
  return value;
}

/**
 * identityCommitment = Poseidon(fullName, identityNumber, nationality, dateOfBirth, salt),
 * the same value the circuit checks. `identity` holds the raw text fields.
 */
export function identityCommitment(identity, salt) {
  const fields = encodeIdentity(identity);
  return poseidon5([fields.fullName, fields.identityNumber, fields.nationality, fields.dateOfBirth, requireSalt(salt)]);
}
