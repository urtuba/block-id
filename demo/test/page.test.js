// Checks on the files the page is made of. They cannot run the page (that needs a
// browser), but they catch the mistakes that would break it silently: a library version
// that drifted from the lockfile, a bare import the import map does not know, a file that
// moved.
import { expect } from "chai";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { newIdentity } from "../identities.js";
import { encodeIdentity } from "../../block-id-sdk/src/index.js";
import { isValidTCID } from "tc-id";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const html = read("index.html");
const importMap = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
const lock = JSON.parse(read("package-lock.json")).packages;

// The Tevm packages are not dependencies of the repo (the demo takes them from jsDelivr only,
// as tweet-verifier does), so there is no lockfile entry. They are pinned by hand.
const TEVM = { "@tevm/node": "1.0.0-rc.153", "@tevm/decorators": "1.0.0-rc.151" };

// Where the lockfile has each library the page uses.
const LOCK_KEY = {
  snarkjs: "node_modules/snarkjs",
  "poseidon-lite": "node_modules/poseidon-lite",
  "@noble/hashes": "block-id-sdk/node_modules/@noble/hashes",
  ethers: "node_modules/ethers",
  "tc-id": "node_modules/tc-id",
};

const parseUrl = (url) => {
  const match = /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/@]+\/)?[^/@]+)@([^/]+)\/(.*)$/.exec(url);
  return match && { name: match[1], version: match[2], path: match[3] };
};

const sourceFiles = (dir, skip = []) =>
  readdirSync(join(root, dir))
    .filter((file) => file.endsWith(".js") && !skip.includes(file))
    .map((file) => `${dir}/${file}`);
// Everything the browser loads from this repo as code. node.js of the SDK is Node-only.
const PAGE_MODULES = [...sourceFiles("demo", ["hardhat.config.js"]), ...sourceFiles("block-id-sdk/src", ["node.js"])];

const importsOf = (code) => [...code.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);

describe("the import map of index.html", () => {
  it("takes every library from jsDelivr at one exact version", () => {
    for (const [name, url] of Object.entries(importMap)) {
      const parsed = parseUrl(url);
      expect(parsed, `${name}: ${url}`).to.not.equal(null);
      expect(parsed.version, `${name} must be an exact version`).to.match(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
      expect(parsed.path, name).to.match(/\+esm$/);
    }
  });

  it("uses the versions of package-lock.json (and the pinned Tevm rc versions)", () => {
    for (const [name, url] of Object.entries(importMap)) {
      const { name: pkg, version } = parseUrl(url);
      if (TEVM[pkg]) expect(version, name).to.equal(TEVM[pkg]);
      else {
        expect(LOCK_KEY[pkg], `${pkg} needs an entry in LOCK_KEY`).to.be.a("string");
        expect(version, `${pkg} in the import map vs package-lock.json`).to.equal(lock[LOCK_KEY[pkg]].version);
      }
    }
  });

  it("knows every bare import of the modules the page loads, and nothing else is bare", () => {
    const bare = new Set();
    for (const file of PAGE_MODULES) {
      for (const specifier of importsOf(read(file))) if (!specifier.startsWith(".")) bare.add(specifier);
    }
    expect([...bare].sort()).to.deep.equal(
      // tc-id, ethers and the Tevm packages are loaded by demo/identities.js and demo/evm.js.
      Object.keys(importMap).sort(),
    );
  });
});

describe("the files of the page", () => {
  it("every relative import resolves to a file", () => {
    for (const file of PAGE_MODULES) {
      for (const specifier of importsOf(read(file)).filter((s) => s.startsWith("."))) {
        expect(existsSync(resolve(root, dirname(file), specifier)), `${file} imports ${specifier}`).to.equal(true);
      }
    }
  });

  it("index.html points only at files that exist", () => {
    const local = [...html.matchAll(/\b(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((url) => !/^(https?:|#|mailto:)/.test(url));
    expect(local).to.include.members(["Favicon.svg", "demo/styles.css", "front-end/hinance/src/constants/hinance.svg"]);
    for (const path of local) expect(existsSync(join(root, path)), path).to.equal(true);
  });

  it("main.js loads the artwork and the circuit artifacts from files that exist", () => {
    const main = read("demo/main.js");
    const art = /const ART = "([^"]+)"/.exec(main)[1];
    const svgs = [...main.matchAll(/\$\{ART\}([\w-]+\.svg)/g)].map((m) => m[1]);
    expect(svgs).to.have.members(["connect-your-identity.svg", "success.svg", "continue-with-blockid.svg"]);
    for (const svg of svgs) expect(existsSync(join(root, art, svg)), svg).to.equal(true);

    const artifacts = [...main.matchAll(/new URL\("\.\.\/([^"]+)", import\.meta\.url\)/g)].map((m) => m[1]);
    expect(artifacts).to.have.members(["circuits/artifacts/identity-proof.wasm", "circuits/artifacts/identity-proof.zkey", "circuits/artifacts/vkey.json"]);
    for (const path of artifacts) expect(existsSync(join(root, path)), path).to.equal(true);
  });

  it("the page code uses no storage and no network except fetching its own files", () => {
    for (const file of sourceFiles("demo", ["hardhat.config.js"])) {
      const code = read(file);
      expect(code, file).to.not.match(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    }
    const fetches = sourceFiles("demo", ["hardhat.config.js"]).flatMap((file) => [...read(file).matchAll(/\bfetch\(([^)]*)\)/g)].map((m) => m[1]));
    expect(fetches.sort()).to.deep.equal(["ARTIFACTS.vkey", "url"]);
  });
});

describe("demo identities", () => {
  it("are valid to the SDK, with a valid-format Turkish ID number", () => {
    for (let i = 0; i < 20; i++) {
      const identity = newIdentity();
      expect(isValidTCID(identity.identityNumber)).to.equal(true);
      expect(() => encodeIdentity(identity)).to.not.throw();
      expect(identity.nationality).to.equal("TR");
    }
  });

  it("differ from one call to the next", () => {
    expect(new Set(Array.from({ length: 10 }, () => newIdentity().identityNumber)).size).to.be.greaterThan(8);
  });
});
