import { expect } from "chai";
import hre from "hardhat";
import { ALICE_ID, OTHER_ID, commitmentOf, makeProof } from "./helpers.js";

describe("BlockID", () => {
  let ethers, blockId, owner, orchestrator, alice, bob, mallory;

  const EX1 = 1n;
  const EX2 = 2n;
  const EX3 = 3n;

  async function deploy(minSources = 2n) {
    ({ ethers } = await hre.network.create());
    [owner, orchestrator, alice, bob, mallory] = await ethers.getSigners();
    const verifier = await ethers.deployContract("Groth16Verifier");
    blockId = await ethers.deployContract("BlockID", [verifier, orchestrator, minSources]);
  }

  async function addExchanges() {
    for (const [name, url] of [
      ["Exchange 1", "https://ex1.example"],
      ["Exchange 2", "https://ex2.example"],
      ["Exchange 3", "https://ex3.example"],
    ]) {
      await blockId.connect(owner).addClient(name, url);
    }
  }

  // Alice's proof of `identity` made by `clientId` for a request.
  const proofFor = (clientId, nonce, { identity = ALICE_ID, wallet = alice.address } = {}) =>
    makeProof({ identity, wallet, clientId, nonce });

  describe("deployment", () => {
    beforeEach(() => deploy());

    it("stores the verifier, orchestrator and minimum sources, and the deployer owns it", async () => {
      expect(await blockId.verifier()).to.not.equal(ethers.ZeroAddress);
      expect(await blockId.orchestrator()).to.equal(orchestrator.address);
      expect(await blockId.minSources()).to.equal(2n);
      expect(await blockId.owner()).to.equal(owner.address);
    });

    it("rejects a zero verifier or orchestrator and zero minimum sources", async () => {
      const verifier = await ethers.deployContract("Groth16Verifier");
      const factory = await ethers.getContractFactory("BlockID");
      await expect(factory.deploy(ethers.ZeroAddress, orchestrator, 2)).to.be.revertedWithCustomError(blockId, "ZeroAddress");
      await expect(factory.deploy(verifier, ethers.ZeroAddress, 2)).to.be.revertedWithCustomError(blockId, "ZeroAddress");
      await expect(factory.deploy(verifier, orchestrator, 0)).to.be.revertedWithCustomError(blockId, "InvalidMinSources");
    });
  });

  describe("exchanges", () => {
    beforeEach(() => deploy());

    it("the owner adds exchanges; ids start at 1", async () => {
      await expect(blockId.connect(owner).addClient("Exchange 1", "https://ex1.example"))
        .to.emit(blockId, "ClientAdded")
        .withArgs(1n, "Exchange 1", "https://ex1.example");
      await blockId.connect(owner).addClient("Exchange 2", "https://ex2.example");

      expect(await blockId.clientCount()).to.equal(2n);
      expect(await blockId.getClient(1)).to.deep.equal(["Exchange 1", "https://ex1.example"]);
      expect(await blockId.getClient(2)).to.deep.equal(["Exchange 2", "https://ex2.example"]);
    });

    it("only the owner can add an exchange", async () => {
      await expect(blockId.connect(mallory).addClient("Evil", "https://evil.example"))
        .to.be.revertedWithCustomError(blockId, "OwnableUnauthorizedAccount")
        .withArgs(mallory.address);
    });

    it("rejects an empty name", async () => {
      await expect(blockId.connect(owner).addClient("", "https://x.example")).to.be.revertedWithCustomError(blockId, "EmptyName");
    });

    it("getClient reverts for id 0 and for an id that does not exist", async () => {
      await addExchanges();
      await expect(blockId.getClient(0)).to.be.revertedWithCustomError(blockId, "UnknownClient").withArgs(0n);
      await expect(blockId.getClient(4)).to.be.revertedWithCustomError(blockId, "UnknownClient").withArgs(4n);
    });

    it("only the owner can change the orchestrator", async () => {
      await expect(blockId.connect(mallory).setOrchestrator(mallory.address))
        .to.be.revertedWithCustomError(blockId, "OwnableUnauthorizedAccount");
      await expect(blockId.connect(owner).setOrchestrator(bob.address))
        .to.emit(blockId, "OrchestratorChanged")
        .withArgs(bob.address);
      expect(await blockId.orchestrator()).to.equal(bob.address);
      await expect(blockId.connect(owner).setOrchestrator(ethers.ZeroAddress)).to.be.revertedWithCustomError(blockId, "ZeroAddress");
    });
  });

  describe("grants", () => {
    beforeEach(async () => {
      await deploy();
      await addExchanges();
    });

    it("a wallet grants and revokes exchanges as sources", async () => {
      await expect(blockId.connect(alice).grant(EX1)).to.emit(blockId, "Granted").withArgs(alice.address, EX1);
      await blockId.connect(alice).grant(EX2);
      expect(await blockId.getGrants(alice.address)).to.deep.equal([EX1, EX2]);
      expect(await blockId.isGranted(alice.address, EX1)).to.equal(true);

      await expect(blockId.connect(alice).revoke(EX1)).to.emit(blockId, "Revoked").withArgs(alice.address, EX1);
      expect(await blockId.getGrants(alice.address)).to.deep.equal([EX2]);
      expect(await blockId.isGranted(alice.address, EX1)).to.equal(false);
    });

    it("keeps the other grants when one in the middle is revoked, and can grant again", async () => {
      for (const id of [EX1, EX2, EX3]) await blockId.connect(alice).grant(id);
      await blockId.connect(alice).revoke(EX1);
      expect([...(await blockId.getGrants(alice.address))].sort()).to.deep.equal([EX2, EX3]);
      expect(await blockId.isGranted(alice.address, EX2)).to.equal(true);
      expect(await blockId.isGranted(alice.address, EX3)).to.equal(true);

      await blockId.connect(alice).revoke(EX3);
      await blockId.connect(alice).revoke(EX2);
      expect(await blockId.getGrants(alice.address)).to.deep.equal([]);
      await blockId.connect(alice).grant(EX1);
      expect(await blockId.getGrants(alice.address)).to.deep.equal([EX1]);
    });

    it("grants belong to the wallet that gave them", async () => {
      await blockId.connect(alice).grant(EX1);
      expect(await blockId.getGrants(bob.address)).to.deep.equal([]);
      expect(await blockId.isGranted(bob.address, EX1)).to.equal(false);
      await expect(blockId.connect(bob).revoke(EX1)).to.be.revertedWithCustomError(blockId, "NotGranted").withArgs(EX1);
    });

    it("rejects an unknown exchange, a double grant and revoking something not granted", async () => {
      await expect(blockId.connect(alice).grant(0)).to.be.revertedWithCustomError(blockId, "UnknownClient");
      await expect(blockId.connect(alice).grant(9)).to.be.revertedWithCustomError(blockId, "UnknownClient");
      await blockId.connect(alice).grant(EX1);
      await expect(blockId.connect(alice).grant(EX1)).to.be.revertedWithCustomError(blockId, "AlreadyGranted").withArgs(EX1);
      await expect(blockId.connect(alice).revoke(EX2)).to.be.revertedWithCustomError(blockId, "NotGranted").withArgs(EX2);
    });
  });

  describe("requestIdentity", () => {
    beforeEach(async () => {
      await deploy();
      await addExchanges();
    });

    it("uses msg.sender as the wallet, numbers requests from 1 and emits IdentityRequested", async () => {
      await blockId.connect(alice).grant(EX1);
      await blockId.connect(alice).grant(EX2);

      await expect(blockId.connect(alice).requestIdentity(EX3))
        .to.emit(blockId, "IdentityRequested")
        .withArgs(alice.address, EX3, 1n);
      await blockId.connect(alice).requestIdentity(EX3);

      expect(await blockId.requestCount()).to.equal(2n);
      expect(await blockId.getRequest(1)).to.deep.equal([alice.address, EX3, false]);
      expect(await blockId.getRequest(2)).to.deep.equal([alice.address, EX3, false]);
    });

    it("is rejected for a wallet that granted nobody", async () => {
      await expect(blockId.connect(alice).requestIdentity(EX3))
        .to.be.revertedWithCustomError(blockId, "NotEnoughSources")
        .withArgs(0n, 2n);
    });

    it("is rejected when too few exchanges were granted", async () => {
      await blockId.connect(alice).grant(EX1);
      await expect(blockId.connect(alice).requestIdentity(EX3))
        .to.be.revertedWithCustomError(blockId, "NotEnoughSources")
        .withArgs(1n, 2n);
    });

    it("does not count the target exchange as a source", async () => {
      await blockId.connect(alice).grant(EX1);
      await blockId.connect(alice).grant(EX3);
      await expect(blockId.connect(alice).requestIdentity(EX3))
        .to.be.revertedWithCustomError(blockId, "NotEnoughSources")
        .withArgs(1n, 2n);
    });

    it("cannot ask for another wallet's identity: someone else's grants do not help", async () => {
      await blockId.connect(alice).grant(EX1);
      await blockId.connect(alice).grant(EX2);
      await expect(blockId.connect(mallory).requestIdentity(EX3)).to.be.revertedWithCustomError(blockId, "NotEnoughSources");
    });

    it("is rejected for an unknown target", async () => {
      await blockId.connect(alice).grant(EX1);
      await blockId.connect(alice).grant(EX2);
      await expect(blockId.connect(alice).requestIdentity(4)).to.be.revertedWithCustomError(blockId, "UnknownClient");
    });

    it("getRequest reverts for an unknown request", async () => {
      await expect(blockId.getRequest(1)).to.be.revertedWithCustomError(blockId, "UnknownRequest").withArgs(1n);
      await expect(blockId.getRequest(0)).to.be.revertedWithCustomError(blockId, "UnknownRequest");
    });
  });

  describe("recordSync", () => {
    // Alice granted exchange 1 and 2 and asked for exchange 3: request 1.
    beforeEach(async () => {
      await deploy();
      await addExchanges();
      await blockId.connect(alice).grant(EX1);
      await blockId.connect(alice).grant(EX2);
      await blockId.connect(alice).requestIdentity(EX3);
    });

    const record = (proofs, { source = EX1, requestId = 1n, from = orchestrator } = {}) =>
      blockId.connect(from).recordSync(requestId, source, proofs);

    it("verifies the proofs on-chain, emits IdentitySynced and stores the result", async () => {
      const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1)];
      const commitment = commitmentOf(ALICE_ID);

      await expect(record(proofs, { source: EX2 }))
        .to.emit(blockId, "IdentitySynced")
        .withArgs(alice.address, EX2, EX3, commitment);

      expect(await blockId.getRequest(1)).to.deep.equal([alice.address, EX3, true]);
      expect(await blockId.getSync(1)).to.deep.equal([alice.address, EX2, EX3, commitment]);
    });

    it("stores and emits only the commitment, no identity data", async () => {
      const receipt = await (await record([await proofFor(EX1, 1), await proofFor(EX2, 1)])).wait();
      const log = blockId.interface.parseLog(receipt.logs.find((l) => l.fragment?.name === "IdentitySynced" || blockId.interface.parseLog(l)?.name === "IdentitySynced"));
      expect(log.args.map(String)).to.deep.equal([alice.address, "1", "3", commitmentOf(ALICE_ID).toString()]);
    });

    it("accepts three sources when the wallet granted three", async () => {
      await addExchanges(); // exchanges 4, 5, 6
      await blockId.connect(alice).grant(4);
      await blockId.connect(alice).requestIdentity(EX3); // request 2
      const proofs = [await proofFor(EX1, 2), await proofFor(EX2, 2), await proofFor(4, 2)];
      await expect(record(proofs, { source: 4n, requestId: 2n })).to.emit(blockId, "IdentitySynced");
    });

    it("getSync reverts before the sync is recorded", async () => {
      await expect(blockId.getSync(1)).to.be.revertedWithCustomError(blockId, "NotSynced").withArgs(1n);
    });

    describe("who may call", () => {
      it("only the orchestrator", async () => {
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1)];
        await expect(record(proofs, { from: mallory })).to.be.revertedWithCustomError(blockId, "NotOrchestrator");
        await expect(record(proofs, { from: alice })).to.be.revertedWithCustomError(blockId, "NotOrchestrator");
        await expect(record(proofs, { from: owner })).to.be.revertedWithCustomError(blockId, "NotOrchestrator");
      });

      it("a new orchestrator after the owner changes it, and not the old one", async () => {
        await blockId.connect(owner).setOrchestrator(bob.address);
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1)];
        await expect(record(proofs, { from: orchestrator })).to.be.revertedWithCustomError(blockId, "NotOrchestrator");
        await expect(record(proofs, { from: bob })).to.emit(blockId, "IdentitySynced");
      });
    });

    describe("the request", () => {
      it("rejects an unknown request", async () => {
        const proofs = [await proofFor(EX1, 2), await proofFor(EX2, 2)];
        await expect(record(proofs, { requestId: 2n })).to.be.revertedWithCustomError(blockId, "UnknownRequest").withArgs(2n);
      });

      it("rejects a second sync for the same request, even with fresh valid proofs", async () => {
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1)];
        await record(proofs);
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "AlreadySynced").withArgs(1n);
      });
    });

    describe("different identity data", () => {
      it("rejects proofs whose identity commitments differ", async () => {
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1, { identity: OTHER_ID })];
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "CommitmentMismatch").withArgs(1n);
      });

      it("rejects when the commitment in the signals is swapped for the other one (proof no longer verifies)", async () => {
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1, { identity: OTHER_ID })];
        proofs[1].pubSignals[0] = proofs[0].pubSignals[0]; // lie about the commitment
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "InvalidProof").withArgs(1n);
      });
    });

    describe("proofs for another wallet, request or exchange", () => {
      it("rejects a proof made for another wallet", async () => {
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1, { wallet: bob.address })];
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "WrongWallet").withArgs(1n);
      });

      it("rejects a proof made for another request (nonce)", async () => {
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 5)];
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "WrongNonce").withArgs(1n);
      });

      it("rejects a proof from an earlier request being replayed for a later one", async () => {
        const old = [await proofFor(EX1, 1), await proofFor(EX2, 1)];
        await record(old);
        await blockId.connect(alice).requestIdentity(EX3); // request 2
        await expect(record(old, { requestId: 2n })).to.be.revertedWithCustomError(blockId, "WrongNonce");
      });

      it("rejects a proof whose signals were edited to look right (the proof no longer verifies)", async () => {
        // Mallory has Exchange 1's proof for request 1 and rewrites its client id to 2.
        const proofs = [await proofFor(EX1, 1), await proofFor(EX1, 1)];
        proofs[1].pubSignals[2] = "2";
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "InvalidProof").withArgs(1n);
      });

      it("rejects a proof with a corrupted curve point", async () => {
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1)];
        proofs[0].pC = [...proofs[0].pA];
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "InvalidProof").withArgs(0n);
      });
    });

    describe("sources", () => {
      it("rejects fewer proofs than the minimum", async () => {
        await expect(record([await proofFor(EX1, 1)]))
          .to.be.revertedWithCustomError(blockId, "NotEnoughProofs")
          .withArgs(1n, 2n);
        await expect(record([])).to.be.revertedWithCustomError(blockId, "NotEnoughProofs").withArgs(0n, 2n);
      });

      it("rejects the same exchange twice", async () => {
        const proofs = [await proofFor(EX1, 1), await proofFor(EX1, 1)];
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "DuplicateSource").withArgs(1n);
      });

      it("rejects an exchange the wallet did not grant", async () => {
        await addExchanges(); // exchange 4
        const proofs = [await proofFor(EX1, 1), await proofFor(4, 1)];
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "NotGranted").withArgs(4n);
      });

      it("rejects a grant that was revoked after the request", async () => {
        await blockId.connect(alice).revoke(EX2);
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1)];
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "NotGranted").withArgs(EX2);
      });

      it("rejects the target exchange as a source", async () => {
        await blockId.connect(alice).grant(EX3);
        const proofs = [await proofFor(EX1, 1), await proofFor(EX3, 1)];
        await expect(record(proofs)).to.be.revertedWithCustomError(blockId, "SourceIsTarget").withArgs(1n);
      });

      it("rejects a data source that has no proof", async () => {
        const proofs = [await proofFor(EX1, 1), await proofFor(EX2, 1)];
        await expect(record(proofs, { source: EX3 })).to.be.revertedWithCustomError(blockId, "SourceNotProven").withArgs(EX3);
      });
    });

    describe("with minSources = 1", () => {
      it("accepts a single proof", async () => {
        await deploy(1n);
        await addExchanges();
        await blockId.connect(alice).grant(EX1);
        await blockId.connect(alice).requestIdentity(EX3);
        await expect(record([await proofFor(EX1, 1)])).to.emit(blockId, "IdentitySynced");
      });
    });
  });
});
