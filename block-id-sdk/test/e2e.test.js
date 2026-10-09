// End to end: BlockID on a Hardhat chain, three in-memory exchanges, a user who did KYC at
// exchanges 1 and 2 and now wants to be verified at exchange 3. Real proofs, real contract.
import { expect } from "chai";
import hre from "hardhat";
import { blockIdAbi, blockIdBytecode, verifierAbi, verifierBytecode } from "block-id-contracts";
import {
  Exchange,
  MemoryNetwork,
  Orchestrator,
  SALT_MESSAGE,
  createChain,
  deriveSalt,
  encodeIdentity,
  identityCommitment,
  normalizeAddress,
  proofToCalldata,
  proveIdentity,
} from "../src/index.js";
import { IDENTITY, artifacts, expectError, vkey } from "./helpers.js";

const EX1 = 1;
const EX2 = 2;
const EX3 = 3;
const OTHER_IDENTITY = { ...IDENTITY, identityNumber: "99999999999" };

/** Deploy the contracts and wire up three exchanges, the way the browser demo will. */
async function scenario() {
  const { ethers } = await hre.network.create();
  const [owner, orchestratorSigner, alice, bob] = await ethers.getSigners();

  const verifier = await new ethers.ContractFactory(verifierAbi, verifierBytecode, owner).deploy();
  const blockId = await new ethers.ContractFactory(blockIdAbi, blockIdBytecode, owner).deploy(
    await verifier.getAddress(),
    orchestratorSigner.address,
    2,
  );
  for (const name of ["Exchange 1", "Exchange 2", "Exchange 3"]) {
    await blockId.addClient(name, `https://${name.toLowerCase().replace(" ", "")}.example`);
  }

  // The user's salt comes from a wallet signature, as in the demo.
  const salt = deriveSalt(await alice.signMessage(SALT_MESSAGE));

  const time = { now: 1_700_000_000_000 };
  const chain = createChain(blockId.connect(orchestratorSigner));
  const network = new MemoryNetwork();
  const exchange = (clientId) =>
    network.add(new Exchange({ clientId, artifacts, chain, transport: network.exchange(clientId), now: () => time.now }));
  const [ex1, ex2, ex3] = [exchange(EX1), exchange(EX2), exchange(EX3)];

  // What BlockID's transport carried, so a test can pick up a share code.
  const traffic = { codes: [] };
  const honest = network.blockId();
  const transport = {
    ...honest,
    createShareCode: async (...args) => {
      const answer = await honest.createShareCode(...args);
      traffic.codes.push({ ...answer, source: args[0], wallet: args[1].wallet });
      return answer;
    },
  };
  const orchestrator = new Orchestrator({ chain, transport, vkey, selectSource: (sources) => sources[0] });

  return { ethers, owner, orchestratorSigner, alice, bob, verifier, blockId, salt, time, chain, network, ex1, ex2, ex3, traffic, transport, orchestrator };
}

/** Alice does KYC at exchanges 1 and 2, grants both, and asks BlockID for exchange 3. */
async function aliceAsksForExchange3(s, { identityAt2 = IDENTITY } = {}) {
  s.ex1.storeKyc({ wallet: s.alice.address, identity: IDENTITY, salt: s.salt });
  s.ex2.storeKyc({ wallet: s.alice.address, identity: identityAt2, salt: s.salt });
  await s.blockId.connect(s.alice).grant(EX1);
  await s.blockId.connect(s.alice).grant(EX2);
  const receipt = await (await s.blockId.connect(s.alice).requestIdentity(EX3)).wait();
  const event = receipt.logs.map((log) => s.blockId.interface.parseLog(log)).find((e) => e?.name === "IdentityRequested");
  return Number(event.args.requestId);
}

describe("end to end: BlockID on Hardhat with three exchanges", () => {
  it("syncs an identity from exchanges 1 and 2 to exchange 3 without BlockID seeing it", async () => {
    const s = await scenario();
    expect(s.ex3.hasRecord(s.alice.address)).to.equal(false);
    const requestId = await aliceAsksForExchange3(s);
    expect(requestId).to.equal(1);

    const result = await s.orchestrator.handleRequest(requestId);

    // The orchestrator proved things only about the commitment.
    const commitment = identityCommitment(IDENTITY, s.salt);
    expect(result).to.include({ requestId, sourceClientId: EX1, targetClientId: EX3 });
    expect(result.wallet).to.equal(normalizeAddress(s.alice.address));
    expect(result.identityCommitment).to.equal(commitment);
    expect(result.provenClientIds).to.deep.equal([EX1, EX2]);

    // On-chain: IdentitySynced, with the commitment and nothing else about the identity.
    const events = await s.blockId.queryFilter(s.blockId.filters.IdentitySynced());
    expect(events).to.have.length(1);
    expect(events[0].args.map(String)).to.deep.equal([s.alice.address, String(EX1), String(EX3), commitment.toString()]);
    expect(await s.blockId.getSync(requestId)).to.deep.equal([s.alice.address, BigInt(EX1), BigInt(EX3), commitment]);

    // Exchange 3 now holds the identity and the salt, and it matches the commitment.
    expect(s.ex3.getRecord(s.alice.address)).to.deep.equal({ identity: IDENTITY, salt: s.salt.toString(), source: "blockid:1" });

    // Exchange 3 can itself act as a source from now on.
    const proof = await s.ex3.provideProof({ wallet: s.alice.address, nonce: 5 });
    expect(proof.publicSignals[0]).to.equal(commitment.toString());
  });

  it("puts no personal data on-chain: not in any transaction input, log or storage-visible value", async () => {
    const s = await scenario();
    const requestId = await aliceAsksForExchange3(s);
    await s.orchestrator.handleRequest(requestId);

    // Every way the data could show up: as UTF-8 text, as a 32-byte field element, and the salt.
    // (The two-letter nationality is only checked as a field element: as text it would match
    // random proof bytes.)
    const asText = (text) => Buffer.from(text, "utf8").toString("hex");
    const asWord = (value) => value.toString(16).padStart(64, "0");
    const fields = encodeIdentity(IDENTITY);
    const forbidden = [
      ...[IDENTITY.fullName, IDENTITY.identityNumber, IDENTITY.dateOfBirth, s.salt.toString()].map((v) => [v, asText(v.toLowerCase())]),
      ...Object.entries(fields).map(([name, value]) => [`${name} as a field element`, asWord(value)]),
      ["salt as a field element", asWord(s.salt)],
    ];

    const latest = await s.ethers.provider.getBlockNumber();
    let scanned = 0;
    for (let n = 0; n <= latest; n++) {
      const block = await s.ethers.provider.getBlock(n, true);
      for (const tx of block.prefetchedTransactions) {
        if (tx.to === null) continue; // contract creation: bytecode, not data
        const receipt = await s.ethers.provider.getTransactionReceipt(tx.hash);
        const haystack = [tx.data, ...receipt.logs.map((l) => l.data)].join("").toLowerCase();
        for (const [label, needle] of forbidden) {
          expect(haystack, `${label} found on-chain`).to.not.include(needle);
        }
        scanned++;
      }
    }
    expect(scanned).to.be.greaterThan(5);
  });

  it("lets anyone re-check the sync from the chain: decode recordSync, verify each proof again", async () => {
    const s = await scenario();
    const requestId = await aliceAsksForExchange3(s);
    const { txHash } = await s.orchestrator.handleRequest(requestId);

    const tx = await s.ethers.provider.getTransaction(txHash);
    const call = s.blockId.interface.parseTransaction({ data: tx.data });
    expect(call.name).to.equal("recordSync");
    const [id, sourceClientId, proofs] = call.args;
    expect(Number(id)).to.equal(requestId);
    expect(Number(sourceClientId)).to.equal(EX1);
    expect(proofs).to.have.length(2);

    const commitments = new Set();
    const plain = (value) => (Array.isArray(value) ? Array.from(value, plain) : value); // ethers Result -> arrays
    for (const p of proofs) {
      expect(await s.verifier.verifyProof(plain(p.pA), plain(p.pB), plain(p.pC), plain(p.pubSignals))).to.equal(true);
      expect(p.pubSignals[1]).to.equal(BigInt(s.alice.address)); // wallet
      expect(p.pubSignals[3]).to.equal(BigInt(requestId)); // nonce
      commitments.add(p.pubSignals[0]);
    }
    expect(commitments.size).to.equal(1);
    expect(proofs.map((p) => Number(p.pubSignals[2]))).to.deep.equal([EX1, EX2]); // the two sources
  });

  it("recordSync with two proofs costs about 0.52M gas (limit 0.7M)", async () => {
    const s = await scenario();
    const requestId = await aliceAsksForExchange3(s);
    const { txHash } = await s.orchestrator.handleRequest(requestId);
    const receipt = await s.ethers.provider.getTransactionReceipt(txHash);
    expect(receipt.gasUsed).to.be.lessThan(700_000n);
  });

  it("derives the same salt every time the wallet signs the message", async () => {
    const s = await scenario();
    expect(deriveSalt(await s.alice.signMessage(SALT_MESSAGE))).to.equal(s.salt);
    expect(deriveSalt(await s.bob.signMessage(SALT_MESSAGE))).to.not.equal(s.salt);
  });

  describe("different identity data at the sources", () => {
    it("the orchestrator does not sync: nothing is recorded and exchange 3 gets nothing", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s, { identityAt2: OTHER_IDENTITY });

      await expectError("IDENTITY_MISMATCH", () => s.orchestrator.handleRequest(requestId));

      expect((await s.blockId.getRequest(requestId))[2]).to.equal(false);
      expect(await s.blockId.queryFilter(s.blockId.filters.IdentitySynced())).to.have.length(0);
      expect(s.ex3.hasRecord(s.alice.address)).to.equal(false);
      expect(s.traffic.codes).to.have.length(0);
    });

    it("the contract rejects it too when the orchestrator tries to record the proofs anyway", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s, { identityAt2: OTHER_IDENTITY });
      const proofs = await Promise.all(
        [s.ex1, s.ex2].map(async (ex) => proofToCalldata(await ex.provideProof({ wallet: s.alice.address, nonce: requestId }))),
      );
      await expect(s.blockId.connect(s.orchestratorSigner).recordSync(requestId, EX1, proofs))
        .to.be.revertedWithCustomError(s.blockId, "CommitmentMismatch")
        .withArgs(1n);
    });
  });

  describe("a proof for another wallet or request", () => {
    // Source 2 answers BlockID with a valid proof that belongs somewhere else.
    const lyingAbout = (s, makeProof) => ({
      ...s.transport,
      requestProof: (client, args) => (client.id === EX2 ? makeProof(args) : s.transport.requestProof(client, args)),
    });

    it("another wallet: rejected by the orchestrator, and by the contract", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      s.ex2.storeKyc({ wallet: s.bob.address, identity: IDENTITY, salt: s.salt });
      const bobsProof = () => s.ex2.provideProof({ wallet: s.bob.address, nonce: requestId });

      s.orchestrator.transport = lyingAbout(s, bobsProof);
      await expectError("PROOF_BINDING", () => s.orchestrator.handleRequest(requestId));

      const honest = await s.ex1.provideProof({ wallet: s.alice.address, nonce: requestId });
      const proofs = [honest, await bobsProof()].map(proofToCalldata);
      await expect(s.blockId.connect(s.orchestratorSigner).recordSync(requestId, EX1, proofs))
        .to.be.revertedWithCustomError(s.blockId, "WrongWallet")
        .withArgs(1n);
      expect(s.ex3.hasRecord(s.alice.address)).to.equal(false);
    });

    it("another request (nonce): rejected by the orchestrator, and by the contract", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      const stale = () => s.ex2.provideProof({ wallet: s.alice.address, nonce: requestId + 41 });

      s.orchestrator.transport = lyingAbout(s, stale);
      await expectError("PROOF_BINDING", () => s.orchestrator.handleRequest(requestId));

      const honest = await s.ex1.provideProof({ wallet: s.alice.address, nonce: requestId });
      const proofs = [honest, await stale()].map(proofToCalldata);
      await expect(s.blockId.connect(s.orchestratorSigner).recordSync(requestId, EX1, proofs))
        .to.be.revertedWithCustomError(s.blockId, "WrongNonce")
        .withArgs(1n);
    });

    it("a proof from an earlier, finished request cannot be replayed for a new one", async () => {
      const s = await scenario();
      const first = await aliceAsksForExchange3(s);
      const firstProofs = await Promise.all(
        [s.ex1, s.ex2].map(async (ex) => proofToCalldata(await ex.provideProof({ wallet: s.alice.address, nonce: first }))),
      );
      await s.orchestrator.handleRequest(first);

      const second = Number((await (await s.blockId.connect(s.alice).requestIdentity(EX3)).wait()).logs
        .map((l) => s.blockId.interface.parseLog(l)).find((e) => e?.name === "IdentityRequested").args.requestId);
      await expect(s.blockId.connect(s.orchestratorSigner).recordSync(second, EX1, firstProofs))
        .to.be.revertedWithCustomError(s.blockId, "WrongNonce");
    });

    it("a proof with an edited public signal is rejected by the contract's verifier", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      const [p1, p2] = await Promise.all(
        [s.ex1, s.ex2].map(async (ex) => proofToCalldata(await ex.provideProof({ wallet: s.alice.address, nonce: requestId }))),
      );
      // Exchange 2 holds OTHER data but copies exchange 1's commitment into its signals.
      s.ex2.storeKyc({ wallet: s.alice.address, identity: OTHER_IDENTITY, salt: s.salt });
      const forged = proofToCalldata(await s.ex2.provideProof({ wallet: s.alice.address, nonce: requestId }));
      forged.pubSignals[0] = p1.pubSignals[0];
      await expect(s.blockId.connect(s.orchestratorSigner).recordSync(requestId, EX1, [p1, forged]))
        .to.be.revertedWithCustomError(s.blockId, "InvalidProof")
        .withArgs(1n);
      void p2;
    });
  });

  describe("share codes", () => {
    it("a share code works once: the second use is rejected", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      await s.orchestrator.handleRequest(requestId);
      const [{ code }] = s.traffic.codes;

      await expectError("SHARE_CODE_USED", () =>
        s.ex3.receiveShare({ requestId, wallet: s.alice.address, source: { id: EX1 }, code }),
      );
    });

    it("an expired share code is rejected", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      s.orchestrator.transport = { ...s.transport, notifyTarget: async () => {} }; // target not told yet
      await s.orchestrator.handleRequest(requestId);
      const [{ code, expiresAt }] = s.traffic.codes;

      s.time.now = expiresAt; // five minutes later
      await expectError("SHARE_CODE_EXPIRED", () =>
        s.ex3.receiveShare({ requestId, wallet: s.alice.address, source: { id: EX1 }, code }),
      );
      expect(s.ex3.hasRecord(s.alice.address)).to.equal(false);
    });

    it("BlockID itself cannot redeem the code it hands out", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      s.orchestrator.transport = { ...s.transport, notifyTarget: async () => {} };
      await s.orchestrator.handleRequest(requestId);
      const [{ code }] = s.traffic.codes;

      await expectError("SHARE_CODE_WRONG_REQUESTER", () =>
        s.ex1.redeemShareCode({ code, wallet: s.alice.address, requester: "blockid" }),
      );
      await expectError("SHARE_CODE_WRONG_REQUESTER", () =>
        s.ex1.redeemShareCode({ code, wallet: s.alice.address, requester: EX2 }),
      );
    });

    it("exchange 3 rejects data that does not match the on-chain commitment", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      // Exchange 1 changes its record after it proved the old one.
      s.orchestrator.transport = {
        ...s.transport,
        notifyTarget: async (client, args) => {
          s.ex1.storeKyc({ wallet: s.alice.address, identity: OTHER_IDENTITY, salt: s.salt });
          return s.transport.notifyTarget(client, args);
        },
      };
      await expectError("DATA_MISMATCH", () => s.orchestrator.handleRequest(requestId));
      expect(s.ex3.hasRecord(s.alice.address)).to.equal(false);
    });
  });

  describe("requests", () => {
    it("a wallet that did not grant any exchange cannot request: the contract rejects it", async () => {
      const s = await scenario();
      await expect(s.blockId.connect(s.bob).requestIdentity(EX3))
        .to.be.revertedWithCustomError(s.blockId, "NotEnoughSources")
        .withArgs(0n, 2n);
    });

    it("a wallet that granted only one exchange cannot request either", async () => {
      const s = await scenario();
      await s.blockId.connect(s.alice).grant(EX1);
      await expect(s.blockId.connect(s.alice).requestIdentity(EX3)).to.be.revertedWithCustomError(s.blockId, "NotEnoughSources");
    });

    it("nobody can request for someone else's wallet: the sender is the wallet", async () => {
      const s = await scenario();
      await aliceAsksForExchange3(s); // Alice has two grants
      // Bob has none, and the function takes no wallet argument to point at Alice.
      expect(s.blockId.interface.getFunction("requestIdentity").inputs.map((i) => i.name)).to.deep.equal(["targetClientId"]);
      await expect(s.blockId.connect(s.bob).requestIdentity(EX3)).to.be.revertedWithCustomError(s.blockId, "NotEnoughSources");
    });

    it("a grant revoked after the request stops the sync", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      await s.blockId.connect(s.alice).revoke(EX2);
      await expectError("NOT_ENOUGH_SOURCES", () => s.orchestrator.handleRequest(requestId));
      expect(s.ex3.hasRecord(s.alice.address)).to.equal(false);
    });

    it("a request can be synced only once", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      await s.orchestrator.handleRequest(requestId);
      await expectError("ALREADY_SYNCED", () => s.orchestrator.handleRequest(requestId));
    });

    it("an unknown request is reported as REQUEST_NOT_FOUND", async () => {
      const s = await scenario();
      await expectError("REQUEST_NOT_FOUND", () => s.orchestrator.handleRequest(7));
    });

    it("only the orchestrator account can record a sync", async () => {
      const s = await scenario();
      const requestId = await aliceAsksForExchange3(s);
      const proofs = await Promise.all(
        [s.ex1, s.ex2].map(async (ex) => proofToCalldata(await ex.provideProof({ wallet: s.alice.address, nonce: requestId }))),
      );
      await expect(s.blockId.connect(s.bob).recordSync(requestId, EX1, proofs)).to.be.revertedWithCustomError(s.blockId, "NotOrchestrator");
      await expect(s.blockId.connect(s.alice).recordSync(requestId, EX1, proofs)).to.be.revertedWithCustomError(s.blockId, "NotOrchestrator");
    });
  });

  describe("watching the chain", () => {
    it("the orchestrator picks up IdentityRequested events and finishes the sync", async () => {
      const s = await scenario();
      s.ex1.storeKyc({ wallet: s.alice.address, identity: IDENTITY, salt: s.salt });
      s.ex2.storeKyc({ wallet: s.alice.address, identity: IDENTITY, salt: s.salt });
      await s.blockId.connect(s.alice).grant(EX1);
      await s.blockId.connect(s.alice).grant(EX2);

      let stop;
      const done = new Promise((resolve, reject) => {
        stop = s.orchestrator.watch({ onResult: resolve, onError: reject });
      });
      await (await s.blockId.connect(s.alice).requestIdentity(EX3)).wait();
      let result;
      try {
        result = await done;
      } finally {
        await stop(); // stops ethers' polling timer, which would keep the test process alive
      }

      expect(result.requestId).to.equal(1);
      expect(s.ex3.hasRecord(s.alice.address)).to.equal(true);
    });
  });
});
