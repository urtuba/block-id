import { expect } from "chai";
import { terminateProver } from "../src/index.js";
import { circuitArtifacts } from "../src/node.js";

// snarkjs starts worker threads. Without this the Node process never exits after the last
// test. A root hook: it runs once, after every test file.
after(async () => {
  await terminateProver();
});

export const { vkey, ...artifacts } = circuitArtifacts();

export const ALICE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
export const BOB = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

export const IDENTITY = {
  fullName: "Ada Lovelace",
  identityNumber: "12345678901",
  nationality: "GB",
  dateOfBirth: "1990-12-10",
};

/** Assert that a promise (or a function that throws) fails with a BlockIdError of this code. */
export async function expectError(code, action) {
  let error;
  try {
    await (typeof action === "function" ? action() : action);
  } catch (e) {
    error = e;
  }
  expect(error, `expected a ${code} error, but nothing was thrown`).to.be.an("error");
  expect(error.code, error.message).to.equal(code);
  return error;
}

// ---------------------------------------------------------------------------------
// A stand-in for the BlockID contract, for tests that do not need a blockchain. It
// implements the `chain` interface of the module and keeps requests, grants, clients and
// syncs in memory. It does NOT verify proofs: the Orchestrator and the real contract do.
// ---------------------------------------------------------------------------------
import { parsePublicSignals } from "../src/index.js";

export class FakeChain {
  constructor({ minSources = 2 } = {}) {
    this.min = minSources;
    this.clients = new Map();
    this.grants = new Map();
    this.requests = new Map();
    this.syncs = new Map();
    this.listeners = [];
    this.recorded = [];
  }

  addClient(name) {
    const id = this.clients.size + 1;
    this.clients.set(id, { id, name, url: `https://${name.toLowerCase().replace(/\W+/g, "-")}.example` });
    return id;
  }

  grant(wallet, clientId) {
    const key = wallet.toLowerCase();
    this.grants.set(key, [...(this.grants.get(key) ?? []), clientId]);
  }

  /** What requestIdentity does on-chain: returns the new request id and tells listeners. */
  request(wallet, targetClientId) {
    const requestId = this.requests.size + 1;
    this.requests.set(requestId, { wallet: wallet.toLowerCase(), targetClientId, fulfilled: false });
    this.listeners.forEach((listener) => listener(requestId, { wallet, targetClientId }));
    return requestId;
  }

  async minSources() { return this.min; }
  async getRequest(id) {
    const request = this.requests.get(id);
    if (!request) throw Object.assign(new Error("no such request"), { code: "REQUEST_NOT_FOUND" });
    return { ...request };
  }
  async getGrants(wallet) { return [...(this.grants.get(wallet.toLowerCase()) ?? [])]; }
  async getClient(id) { return { ...this.clients.get(id) }; }

  async recordSync({ requestId, sourceClientId, proofs }) {
    this.recorded.push({ requestId, sourceClientId, proofs });
    const request = this.requests.get(requestId);
    request.fulfilled = true;
    const signals = parsePublicSignals(proofs[0].pubSignals);
    this.syncs.set(requestId, {
      wallet: request.wallet,
      sourceClientId,
      targetClientId: request.targetClientId,
      identityCommitment: signals.identityCommitment,
    });
    return { txHash: `0xfake${requestId}` };
  }

  async getSync(requestId) {
    const sync = this.syncs.get(requestId);
    if (!sync) throw Object.assign(new Error("not synced"), { code: "REQUEST_NOT_FOUND" });
    return { ...sync };
  }

  onIdentityRequested(handler) {
    this.listeners.push(handler);
    return () => { this.listeners = this.listeners.filter((l) => l !== handler); };
  }
}
