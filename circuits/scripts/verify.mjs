// npm run verify -w circuits
// Checks that the committed zkey was made from the committed r1cs and the Hermez powers
// of tau file (downloaded and hash-checked). It does not prove that the phase-2
// contributor threw their entropy away; nobody can prove that.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePtau } from "./ptau.mjs";

const require = createRequire(import.meta.url);
const artifacts = join(dirname(fileURLToPath(import.meta.url)), "..", "artifacts");
const snarkjs = join(dirname(require.resolve("snarkjs")), "cli.cjs");

const ptau = await ensurePtau();
execFileSync(
  process.execPath,
  [snarkjs, "zkey", "verify", join(artifacts, "identity-proof.r1cs"), ptau, join(artifacts, "identity-proof.zkey")],
  { stdio: "inherit" },
);
