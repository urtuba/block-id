import * as ethers from "ethers";
import hre from "hardhat";
import { after } from "mocha";
import { terminateProver } from "../../block-id-sdk/src/index.js";
import { circuitArtifacts } from "../../block-id-sdk/src/node.js";
import { createWorld } from "../world.js";

// snarkjs starts worker threads. Without this the Node process never exits after the last test.
after(async () => {
  await terminateProver();
});

export const { vkey, ...artifacts } = circuitArtifacts();

export const IDENTITY = {
  fullName: "Deniz Yilmaz",
  identityNumber: "10000000146",
  nationality: "TR",
  dateOfBirth: "1990-12-10",
};

/** A fresh Hardhat chain with the demo world on it, wired the way the page wires it. */
export async function freshWorld(options = {}) {
  const connection = await hre.network.create();
  const provider = new ethers.BrowserProvider(connection.provider, undefined, { cacheTimeout: -1 });
  const fund = (address) => provider.send("hardhat_setBalance", [address, ethers.toQuantity(100n * 10n ** 18n)]);
  return createWorld({ ethers, provider, fund, artifacts, vkey, selectSource: (sources) => sources[0], ...options });
}
