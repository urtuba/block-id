// Node-only helpers: the committed circuit artifacts as file paths and the verification key.
// Not part of the browser build; in a browser, pass URLs to the artifacts instead.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { artifactUrls } from "block-id-circuits";

export function circuitArtifacts() {
  return {
    wasm: fileURLToPath(artifactUrls.wasm),
    zkey: fileURLToPath(artifactUrls.zkey),
    vkey: JSON.parse(readFileSync(artifactUrls.vkey, "utf8")),
  };
}
