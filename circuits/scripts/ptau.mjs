// The Hermez (Polygon zkEVM) perpetual powers of tau ceremony, phase 1.
//
// The circuit has 324 constraints (see README), so the 2^9 file is the smallest one
// that fits: snarkjs needs 2^power >= constraints + public inputs + 1, and 2^8 = 256
// is too small.
//
// The hash is copied from the table in the README of snarkjs ("Prepared (phase2) Ptau
// files for bn128 with 54 contributions and a beacon"). It is blake2b-512, the same as
// `b2sum` prints. test/ptau-hash.test.js compares it with the README of the snarkjs
// version installed from npm, so it cannot drift.
//
// The URL is the one in the README on snarkjs' main branch. The README shipped in the
// npm package of 0.7.6 still links storage.googleapis.com/zkevm/ptau/, which answers
// 403 today. The hash is the same in both, and the download is checked against it, so
// the host does not have to be trusted.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PTAU_POWER = 9;
export const PTAU_FILE = "powersOfTau28_hez_final_09.ptau";
export const PTAU_URL = "https://circom.info/powersOfTau28_hez_final_09.ptau";
export const PTAU_BLAKE2B =
  "94f108a80e81b5d932d8e8c9e8fd7f46cf32457e31462deeeef37af1b71c2c1b3c71fb0d9b59c654ec266b042735f50311f9fd1d4cadce47ab234ad163157cb5";

const circuitsDir = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PTAU_PATH = join(circuitsDir, "build", "ptau", PTAU_FILE);

export function blake2b512(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash("blake2b512");
    createReadStream(path)
      .on("error", reject)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Make sure the ptau file is in circuits/build/ptau and has the published hash.
 * Downloads it if missing. A file with a wrong hash is deleted and the call throws.
 */
export async function ensurePtau({ log = console.log } = {}) {
  if (existsSync(PTAU_PATH) && (await blake2b512(PTAU_PATH)) === PTAU_BLAKE2B) {
    log(`ptau: ${PTAU_FILE} is present, hash ok`);
    return PTAU_PATH;
  }
  log(`ptau: downloading ${PTAU_URL}`);
  const response = await fetch(PTAU_URL);
  if (!response.ok) throw new Error(`ptau download failed: HTTP ${response.status}`);
  mkdirSync(dirname(PTAU_PATH), { recursive: true });
  writeFileSync(PTAU_PATH, Buffer.from(await response.arrayBuffer()));
  const actual = await blake2b512(PTAU_PATH);
  if (actual !== PTAU_BLAKE2B) {
    rmSync(PTAU_PATH);
    throw new Error(`ptau hash mismatch: expected ${PTAU_BLAKE2B}, got ${actual}. File deleted.`);
  }
  log("ptau: blake2b-512 hash matches the snarkjs README");
  return PTAU_PATH;
}
