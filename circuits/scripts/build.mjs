// Rebuild the circuit and everything derived from it:
//   circom2   identity-proof.circom -> r1cs + wasm            (circuits/build, ignored)
//   snarkjs   Groth16 setup + one phase-2 contribution -> zkey
//   outputs   circuits/artifacts/{identity-proof.wasm, identity-proof.r1cs, identity-proof.zkey, vkey.json}
//             contracts/contracts/IdentityProofVerifier.sol
//
// The phase-2 contribution uses fresh random entropy that is never saved, so every run
// produces new keys: commit the artifacts and the verifier together, and run the tests.
// One contribution by one person is demo-grade. See "Known limitations" in the README.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePtau } from "./ptau.mjs";

const require = createRequire(import.meta.url);
const circuitsDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(circuitsDir, "build");
const artifactsDir = join(circuitsDir, "artifacts");
const verifierPath = join(circuitsDir, "..", "contracts", "contracts", "IdentityProofVerifier.sol");

const circom2 = require.resolve("circom2/cli.js");
const snarkjs = join(dirname(require.resolve("snarkjs")), "cli.cjs"); // main.cjs and cli.cjs sit side by side
const circomlibCircuits = join(dirname(require.resolve("circomlib/package.json")), "circuits");

const run = (script, args, cwd = process.cwd()) =>
  execFileSync(process.execPath, [script, ...args], { stdio: "inherit", cwd });

// circom2 is circom compiled to WebAssembly and runs in a WASI sandbox that can only
// see the working directory. Run it from the repository root with relative paths.
const repoRoot = join(circuitsDir, "..");
const rel = (path) => relative(repoRoot, path);

const name = "identity-proof";
const r1cs = join(buildDir, `${name}.r1cs`);
const wasm = join(buildDir, `${name}_js`, `${name}.wasm`);
const zkey0 = join(buildDir, `${name}_0000.zkey`);
const zkey1 = join(buildDir, `${name}_0001.zkey`);

rmSync(buildDir, { recursive: true, force: true, maxRetries: 3 });
mkdirSync(buildDir, { recursive: true });

// 1. Compile. --O2 gives full constraint simplification.
run(
  circom2,
  [rel(join(circuitsDir, `${name}.circom`)), "--r1cs", "--wasm", "--sym", "--O2", "-l", rel(circomlibCircuits), "-o", rel(buildDir)],
  repoRoot,
);
run(snarkjs, ["r1cs", "info", r1cs]);

// 2. Phase 1: the public Hermez ceremony file, hash-checked.
const ptau = await ensurePtau();

// 3. Phase 2: circuit-specific setup with one contribution, then check the zkey.
run(snarkjs, ["groth16", "setup", r1cs, ptau, zkey0]);
run(snarkjs, ["zkey", "contribute", zkey0, zkey1, "--name=BlockID demo contribution", `-e=${randomBytes(32).toString("hex")}`]);
run(snarkjs, ["zkey", "verify", r1cs, ptau, zkey1]);

// 4. Export what the demo and the contract need.
mkdirSync(artifactsDir, { recursive: true });
copyFileSync(wasm, join(artifactsDir, `${name}.wasm`));
copyFileSync(r1cs, join(artifactsDir, `${name}.r1cs`)); // for audits: `npm run verify` and the r1cs tests
copyFileSync(zkey1, join(artifactsDir, `${name}.zkey`));
run(snarkjs, ["zkey", "export", "verificationkey", zkey1, join(artifactsDir, "vkey.json")]);
mkdirSync(dirname(verifierPath), { recursive: true });
run(snarkjs, ["zkey", "export", "solidityverifier", zkey1, verifierPath]);

console.log("\nDone. Commit circuits/artifacts and contracts/contracts/IdentityProofVerifier.sol together.");
