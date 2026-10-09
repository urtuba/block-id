import { expect } from "chai";
import { Exchange, MemoryNetwork, Orchestrator, identityCommitment } from "../src/index.js";
import { ALICE, BOB, FakeChain, IDENTITY, artifacts, expectError, vkey } from "./helpers.js";

const SALT = 8675309123456789012345678901234567890n;
const OTHER_IDENTITY = { ...IDENTITY, identityNumber: "99999999999" };

/**
 * Three exchanges. Alice did KYC at 1 and 2 (same data, same salt), granted both, and asked
 * for exchange 3. `transportFor` lets a test replace what BlockID's transport does.
 */
function world({ identity2 = IDENTITY, transportFor = (t) => t } = {}) {
  const chain = new FakeChain();
  ["Exchange 1", "Exchange 2", "Exchange 3"].forEach((name) => chain.addClient(name));
  const network = new MemoryNetwork();
  const ex1 = network.add(new Exchange({ clientId: 1, artifacts }));
  const ex2 = network.add(new Exchange({ clientId: 2, artifacts }));
  const ex3 = network.add(new Exchange({ clientId: 3, artifacts, chain, transport: network.exchange(3) }));
  ex1.storeKyc({ wallet: ALICE, identity: IDENTITY, salt: SALT });
  ex2.storeKyc({ wallet: ALICE, identity: identity2, salt: SALT });
  chain.grant(ALICE, 1);
  chain.grant(ALICE, 2);
  const requestId = chain.request(ALICE, 3);

  const seen = []; // everything BlockID's transport returned to the orchestrator
  const honest = network.blockId();
  const spy = {
    ...honest,
    requestProof: async (...args) => { const r = await honest.requestProof(...args); seen.push(r); return r; },
    createShareCode: async (...args) => { const r = await honest.createShareCode(...args); seen.push(r); return r; },
  };
  const transport = transportFor(spy, { network, ex1, ex2, ex3 });
  const orchestrator = new Orchestrator({ chain, transport, vkey, selectSource: (sources) => sources[0] });
  return { chain, network, ex1, ex2, ex3, requestId, orchestrator, seen, transport };
}

describe("Orchestrator", () => {
  describe("a normal request", () => {
    it("collects proofs, records the sync and gives the target the identity", async () => {
      const { orchestrator, chain, ex3, requestId } = world();
      const result = await orchestrator.handleRequest(requestId);

      expect(result).to.include({ requestId, wallet: ALICE.toLowerCase(), sourceClientId: 1, targetClientId: 3 });
      expect(result.identityCommitment).to.equal(identityCommitment(IDENTITY, SALT));
      expect(result.provenClientIds).to.deep.equal([1, 2]);
      expect(result.skipped).to.deep.equal([]);

      expect(chain.recorded).to.have.length(1);
      expect(chain.recorded[0]).to.include({ requestId, sourceClientId: 1 });
      expect(chain.recorded[0].proofs).to.have.length(2);
      expect(chain.requests.get(requestId).fulfilled).to.equal(true);

      expect(ex3.getRecord(ALICE)).to.deep.equal({ identity: IDENTITY, salt: SALT.toString(), source: "blockid:1" });
    });

    it("never sees identity data or the salt, only proofs and a share code", async () => {
      const { orchestrator, seen, requestId, chain } = world();
      const result = await orchestrator.handleRequest(requestId);
      const everything = JSON.stringify([seen, chain.recorded, result, [...chain.syncs.values()]], (_, v) => (typeof v === "bigint" ? v.toString() : v)).toLowerCase();
      for (const secret of [...Object.values(IDENTITY), SALT.toString()]) {
        expect(everything).to.not.include(secret.toLowerCase());
      }
    });

    it("picks the source with selectSource", async () => {
      const w = world();
      w.orchestrator.selectSource = (sources) => sources.find((s) => s.id === 2);
      const result = await w.orchestrator.handleRequest(w.requestId);
      expect(result.sourceClientId).to.equal(2);
      expect(w.ex3.getRecord(ALICE).source).to.equal("blockid:2");
    });

    it("uses a random source by default, always one of the proven", async () => {
      const w = world();
      w.orchestrator.selectSource = new Orchestrator({ chain: w.chain, transport: w.transport, vkey }).selectSource;
      const picks = new Set();
      for (let i = 0; i < 20; i++) picks.add(w.orchestrator.selectSource([{ id: 1 }, { id: 2 }]).id);
      expect([...picks].every((id) => id === 1 || id === 2)).to.equal(true);
    });
  });

  describe("different identity data at the sources", () => {
    it("does not sync: IDENTITY_MISMATCH, nothing recorded, no share code issued, target gets nothing", async () => {
      const { orchestrator, chain, ex1, ex2, ex3, requestId } = world({ identity2: OTHER_IDENTITY });
      await expectError("IDENTITY_MISMATCH", () => orchestrator.handleRequest(requestId));

      expect(chain.recorded).to.have.length(0);
      expect(chain.requests.get(requestId).fulfilled).to.equal(false);
      expect(ex1.codes.size + ex2.codes.size).to.equal(0);
      expect(ex3.hasRecord(ALICE)).to.equal(false);
    });

    it("a different salt at one source is also a mismatch", async () => {
      const w = world();
      w.ex2.storeKyc({ wallet: ALICE, identity: IDENTITY, salt: SALT + 1n });
      await expectError("IDENTITY_MISMATCH", () => w.orchestrator.handleRequest(w.requestId));
    });
  });

  describe("proofs that do not belong to this request", () => {
    // A malicious or buggy source answers with a proof that is valid, but made for something else.
    const lying = (mutate) => (spy, { ex2 }) => ({
      ...spy,
      requestProof: async (client, args) =>
        client.id === 2 ? mutate(ex2, args) : spy.requestProof(client, args),
    });

    it("rejects a proof for another wallet", async () => {
      const { orchestrator, chain, requestId } = world({
        transportFor: lying(async (ex2, { nonce }) => {
          ex2.storeKyc({ wallet: BOB, identity: IDENTITY, salt: SALT });
          return ex2.provideProof({ wallet: BOB, nonce });
        }),
      });
      const error = await expectError("PROOF_BINDING", () => orchestrator.handleRequest(requestId));
      expect(error.message).to.match(/another wallet/);
      expect(chain.recorded).to.have.length(0);
    });

    it("rejects a proof for another request (an old proof replayed)", async () => {
      const { orchestrator, chain, requestId } = world({
        transportFor: lying((ex2, { wallet }) => ex2.provideProof({ wallet, nonce: 99 })),
      });
      const error = await expectError("PROOF_BINDING", () => orchestrator.handleRequest(requestId));
      expect(error.message).to.match(/another request/);
      expect(chain.recorded).to.have.length(0);
    });

    it("rejects exchange 1's proof passed off as exchange 2's", async () => {
      const { orchestrator, chain, requestId } = world({
        // When asked for exchange 2, the transport returns exchange 1's answer.
        transportFor: (spy) => ({
          ...spy,
          requestProof: (client, args) => spy.requestProof(client.id === 2 ? { id: 1 } : client, args),
        }),
      });
      const error = await expectError("PROOF_BINDING", () => orchestrator.handleRequest(requestId));
      expect(error.message).to.match(/another exchange/);
      expect(chain.recorded).to.have.length(0);
    });

    it("rejects a proof whose public signals were edited (it no longer verifies)", async () => {
      const { orchestrator, chain, requestId } = world({
        transportFor: lying(async (ex2, { wallet, nonce }) => {
          // Source 2 really holds OTHER_IDENTITY but claims the commitment of IDENTITY.
          ex2.storeKyc({ wallet, identity: OTHER_IDENTITY, salt: SALT });
          const answer = await ex2.provideProof({ wallet, nonce });
          answer.publicSignals[0] = identityCommitment(IDENTITY, SALT).toString();
          return answer;
        }),
      });
      await expectError("PROOF_INVALID", () => orchestrator.handleRequest(requestId));
      expect(chain.recorded).to.have.length(0);
    });

    it("rejects a proof whose curve points were replaced", async () => {
      const { orchestrator, chain, requestId } = world({
        transportFor: lying(async (ex2, args) => {
          const answer = await ex2.provideProof(args);
          answer.proof.pi_c = answer.proof.pi_a;
          return answer;
        }),
      });
      await expectError("PROOF_INVALID", () => orchestrator.handleRequest(requestId));
      expect(chain.recorded).to.have.length(0);
    });
  });

  describe("sources that cannot answer", () => {
    it("skips a granted source without an identity if enough others answer", async () => {
      const w = world();
      const ex4 = w.network.add(new Exchange({ clientId: 4, artifacts }));
      w.chain.addClient("Exchange 4");
      w.chain.grant(ALICE, 4); // granted, but never did KYC there
      const result = await w.orchestrator.handleRequest(w.requestId);
      expect(result.provenClientIds).to.deep.equal([1, 2]);
      expect(result.skipped).to.deep.equal([{ clientId: 4, error: "NO_KYC_RECORD" }]);
      expect(ex4.hasRecord(ALICE)).to.equal(false);
    });

    it("fails when too few sources answer", async () => {
      const w = world();
      w.ex2.records.clear();
      const error = await expectError("NOT_ENOUGH_PROOFS", () => w.orchestrator.handleRequest(w.requestId));
      expect(error.details.skipped).to.deep.equal([{ clientId: 2, error: "NO_KYC_RECORD" }]);
      expect(w.chain.recorded).to.have.length(0);
    });

    it("counts an exchange that is not on the network as skipped", async () => {
      const w = world();
      w.network.exchanges.delete(2);
      await expectError("NOT_ENOUGH_PROOFS", () => w.orchestrator.handleRequest(w.requestId));
    });
  });

  describe("the request", () => {
    it("rejects a wallet that granted too few sources", async () => {
      const w = world();
      w.chain.grants.set(ALICE.toLowerCase(), [1]);
      await expectError("NOT_ENOUGH_SOURCES", () => w.orchestrator.handleRequest(w.requestId));
    });

    it("does not count the target as a source", async () => {
      const w = world();
      w.chain.grants.set(ALICE.toLowerCase(), [1, 3]);
      await expectError("NOT_ENOUGH_SOURCES", () => w.orchestrator.handleRequest(w.requestId));
    });

    it("rejects a request that is already synced", async () => {
      const w = world();
      await w.orchestrator.handleRequest(w.requestId);
      await expectError("ALREADY_SYNCED", () => w.orchestrator.handleRequest(w.requestId));
      expect(w.chain.recorded).to.have.length(1);
    });

    it("rejects a request that does not exist", async () => {
      const w = world();
      await expectError("REQUEST_NOT_FOUND", () => w.orchestrator.handleRequest(42));
    });

    it("a wallet that did not grant cannot get a sync for itself or anyone else", async () => {
      const w = world();
      const bobRequest = w.chain.request(BOB, 3); // Bob granted nobody
      await expectError("NOT_ENOUGH_SOURCES", () => w.orchestrator.handleRequest(bobRequest));
      expect(w.chain.recorded).to.have.length(0);
    });
  });

  describe("ordering", () => {
    it("does not tell the target before the chain accepted the sync", async () => {
      const w = world();
      w.chain.recordSync = async () => { throw new Error("chain rejected the sync"); };
      let notified = false;
      w.orchestrator.transport = { ...w.transport, notifyTarget: async () => { notified = true; } };
      let error;
      try { await w.orchestrator.handleRequest(w.requestId); } catch (e) { error = e; }
      expect(error.message).to.equal("chain rejected the sync");
      expect(notified).to.equal(false);
      expect(w.ex3.hasRecord(ALICE)).to.equal(false);
    });

    it("the share code expires if the sync fails after it was issued", async () => {
      let clock = 1000;
      const w = world();
      w.ex1.now = () => clock;
      w.ex2.now = () => clock;
      w.chain.recordSync = async () => { throw new Error("nope"); };
      await w.orchestrator.handleRequest(w.requestId).catch(() => {});
      const [code] = [...w.ex1.codes.keys()];
      clock += w.ex1.codeTtlMs;
      await expectError("SHARE_CODE_EXPIRED", () => w.ex1.redeemShareCode({ code, wallet: ALICE, requester: 3 }));
    });
  });

  describe("watch", () => {
    it("handles each IdentityRequested event and reports the result", async () => {
      const w = world();
      const done = new Promise((resolve, reject) => {
        const stop = w.orchestrator.watch({ onResult: (result) => { stop(); resolve(result); }, onError: reject });
      });
      const another = w.chain.request(ALICE, 3);
      const result = await done;
      expect(result).to.include({ requestId: another, targetClientId: 3 });
      expect(w.chain.listeners).to.have.length(0);
      expect(w.ex3.hasRecord(ALICE)).to.equal(true);
    });

    it("reports errors with the request id and keeps going", async () => {
      const w = world();
      const errors = [];
      const failed = new Promise((resolve) => {
        w.orchestrator.watch({ onError: (e, id) => { errors.push([e.code, id]); resolve(); } });
      });
      const bobRequest = w.chain.request(BOB, 3);
      await failed;
      expect(errors).to.deep.equal([["NOT_ENOUGH_SOURCES", bobRequest]]);
    });
  });
});
