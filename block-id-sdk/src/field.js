import { sha256 } from "@noble/hashes/sha2.js";
import { BlockIdError } from "./errors.js";

/** The scalar field of BN254 (alt_bn128), the field the circuit works in. */
export const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** The identity fields, in the order the circuit and the commitment use them. */
export const IDENTITY_FIELDS = ["fullName", "identityNumber", "nationality", "dateOfBirth"];

const utf8 = new TextEncoder();

const bytesToBigInt = (bytes) => {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
};

const requireString = (name, value) => {
  if (typeof value !== "string") throw new BlockIdError("INVALID_INPUT", `${name} must be a string`, { name });
  return value;
};

/**
 * Canonical form of a text field, so two exchanges that spell the same person the same way
 * up to case and spacing get the same field element: Unicode NFC, trimmed, runs of
 * whitespace collapsed to one space, lower case (locale-independent). Nothing else is
 * touched: no accent stripping, no transliteration. The exchanges have to agree on the
 * rest (see "Known limitations" in the README).
 */
export function normalizeText(name, value) {
  const text = requireString(name, value).normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
  if (text === "") throw new BlockIdError("INVALID_INPUT", `${name} must not be empty`, { name });
  return text;
}

/** SHA-256 of a domain-tagged text, reduced into the field. The tag keeps fields apart. */
export function encodeText(name, value) {
  const digest = sha256(utf8.encode(`blockid:v1:${name}:${normalizeText(name, value)}`));
  return bytesToBigInt(digest) % FIELD_PRIME;
}

/** A calendar date "YYYY-MM-DD" as the number YYYYMMDD. Rejects dates that do not exist. */
export function encodeDate(name, value) {
  const text = requireString(name, value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date = match && new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const real =
    date &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3]);
  if (!real) throw new BlockIdError("INVALID_INPUT", `${name} must be a real date as YYYY-MM-DD`, { name, value });
  return BigInt(match[1] + match[2] + match[3]);
}

/**
 * The four identity fields as field elements, named as the circuit's private inputs:
 * { fullName, identityNumber, nationality, dateOfBirth } -> bigint each.
 * `dateOfBirth` is "YYYY-MM-DD"; the others are free text.
 */
export function encodeIdentity(identity) {
  if (identity === null || typeof identity !== "object") {
    throw new BlockIdError("INVALID_INPUT", "identity must be an object");
  }
  return {
    fullName: encodeText("fullName", identity.fullName),
    identityNumber: encodeText("identityNumber", identity.identityNumber),
    nationality: encodeText("nationality", identity.nationality),
    dateOfBirth: encodeDate("dateOfBirth", identity.dateOfBirth),
  };
}

/** Lower-case 0x address. Checks the shape only, not the EIP-55 checksum. */
export function normalizeAddress(address) {
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new BlockIdError("INVALID_INPUT", "wallet must be a 0x address with 40 hex digits", { address });
  }
  return address.toLowerCase();
}

/** A wallet address as the field element the circuit and the contract use. */
export const walletToField = (address) => BigInt(normalizeAddress(address));

/** The inverse of walletToField. */
export const fieldToWallet = (value) => `0x${BigInt(value).toString(16).padStart(40, "0")}`;

/** An id (client id, request id) must be a positive safe integer. */
export function requireId(name, value) {
  const id = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new BlockIdError("INVALID_INPUT", `${name} must be a positive integer`, { name, value: String(value) });
  }
  return id;
}

/**
 * The message a wallet signs to derive its salt. Only sign it in a page you trust: whoever
 * gets the signature gets the salt.
 */
export const SALT_MESSAGE =
  "BlockID salt v1\n\nSigning this message derives your BlockID salt. The salt stays with you " +
  "and with the exchanges you verify with. Only sign it on a site you trust.";

/**
 * The salt from a wallet signature of SALT_MESSAGE (a hex string). It is deterministic
 * when the wallet signs deterministically (RFC 6979, as MetaMask does), so the user gets
 * the same salt on every device without storing it.
 */
export function deriveSalt(signature) {
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130,}$/.test(signature)) {
    throw new BlockIdError("INVALID_INPUT", "signature must be a hex string of at least 65 bytes");
  }
  const bytes = Uint8Array.from(signature.slice(2).match(/../g), (pair) => parseInt(pair, 16));
  const salt = bytesToBigInt(sha256(Uint8Array.from([...utf8.encode("blockid:v1:salt:"), ...bytes]))) % FIELD_PRIME;
  return salt === 0n ? 1n : salt;
}

/** A random salt, for tests and for wallets that cannot sign deterministically. */
export function randomSalt(getRandomValues = (a) => globalThis.crypto.getRandomValues(a)) {
  const bytes = getRandomValues(new Uint8Array(48)); // 384 bits: reduction bias is negligible
  const salt = bytesToBigInt(bytes) % FIELD_PRIME;
  return salt === 0n ? 1n : salt;
}
