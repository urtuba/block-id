import { expect } from "chai";
import { Exchange, MemoryNetwork, parsePublicSignals, verifyIdentityProof, identityCommitment } from "../src/index.js";
import { ALICE, BOB, FakeChain, IDENTITY, artifacts, expectError, vkey } from "./helpers.js";

const SALT = 424242n;

describe("Exchange (source side)", () => {
  let clock, exchange;
  const now = () => clock;

  beforeEach(() => {
    clock = 1_000_000;
    exchange = new Exchange({ clientId: 1, artifacts, now, codeTtlMs: 60_000 });
    exchange.storeKyc({ wallet: ALICE, identity: IDENTITY, salt: SALT });
  });

  describe("KYC records", () => {
    it("stores a record per wallet and finds it in any address case", () => {
      expect(exchange.hasRecord(ALICE)).to.equal(true);
      expect(exchange.hasRecord(ALICE.toLowerCase())).to.equal(true);
      expect(exchange.hasRecord(BOB)).to.equal(false);
      expect(exchange.getRecord(ALICE).identity).to.deep.equal(IDENTITY);
    });

    it("rejects an invalid identity, wallet or salt", async () => {
      await expectError("INVALID_INPUT", () => exchange.storeKyc({ wallet: BOB, identity: { ...IDENTITY, dateOfBirth: "nope" }, salt: SALT }));
      await expectError("INVALID_INPUT", () => exchange.storeKyc({ wallet: "0x1", identity: IDENTITY, salt: SALT }));
      await expectError("INVALID_INPUT", () => exchange.storeKyc({ wallet: BOB, identity: IDENTITY, salt: 0n }));
      expect(exchange.hasRecord(BOB)).to.equal(false);
    });
  });

  describe("provideProof", () => {
    it("proves the stored identity for the wallet, as this exchange, for the request", async () => {
      const answer = await exchange.provideProof({ wallet: ALICE, nonce: 5 });
      expect(answer.clientId).to.equal(1);
      expect(await verifyIdentityProof(vkey, answer)).to.equal(true);
      expect(parsePublicSignals(answer.publicSignals)).to.deep.equal({
        identityCommitment: identityCommitment(IDENTITY, SALT),
        wallet: ALICE.toLowerCase(),
        clientId: 1,
        nonce: 5,
      });
    });

    it("does not carry identity data or the salt in what it returns", async () => {
      const answer = JSON.stringify(await exchange.provideProof({ wallet: ALICE, nonce: 5 }));
      for (const secret of [...Object.values(IDENTITY), SALT.toString()]) {
        expect(answer.toLowerCase()).to.not.include(secret.toLowerCase());
      }
    });

    it("refuses a wallet it has no identity for", async () => {
      await expectError("NO_KYC_RECORD", () => exchange.provideProof({ wallet: BOB, nonce: 5 }));
    });
  });

  describe("share codes", () => {
    it("redeems once for the identity and salt, for the exchange it was issued for", () => {
      const { code, expiresAt } = exchange.createShareCode({ wallet: ALICE, targetClientId: 3 });
      expect(code).to.match(/^[0-9a-f]{32}$/);
      expect(expiresAt).to.equal(clock + 60_000);
      expect(exchange.redeemShareCode({ code, wallet: ALICE, requester: 3 })).to.deep.equal({
        identity: IDENTITY,
        salt: SALT.toString(),
      });
    });

    it("issues different codes each time", () => {
      const a = exchange.createShareCode({ wallet: ALICE, targetClientId: 3 }).code;
      const b = exchange.createShareCode({ wallet: ALICE, targetClientId: 3 }).code;
      expect(a).to.not.equal(b);
    });

    it("rejects a code that was already used", async () => {
      const { code } = exchange.createShareCode({ wallet: ALICE, targetClientId: 3 });
      exchange.redeemShareCode({ code, wallet: ALICE, requester: 3 });
      await expectError("SHARE_CODE_USED", () => exchange.redeemShareCode({ code, wallet: ALICE, requester: 3 }));
    });

    it("rejects an expired code, from the last millisecond on", async () => {
      const { code, expiresAt } = exchange.createShareCode({ wallet: ALICE, targetClientId: 3 });
      clock = expiresAt - 1;
      expect(exchange.redeemShareCode({ code, wallet: ALICE, requester: 3 }).salt).to.equal(SALT.toString());

      const second = exchange.createShareCode({ wallet: ALICE, targetClientId: 3 });
      clock = second.expiresAt;
      await expectError("SHARE_CODE_EXPIRED", () => exchange.redeemShareCode({ code: second.code, wallet: ALICE, requester: 3 }));
    });

    it("rejects an unknown code and a code for another wallet", async () => {
      exchange.storeKyc({ wallet: BOB, identity: { ...IDENTITY, fullName: "Bob" }, salt: SALT });
      const { code } = exchange.createShareCode({ wallet: ALICE, targetClientId: 3 });
      await expectError("SHARE_CODE_INVALID", () => exchange.redeemShareCode({ code: "00".repeat(16), wallet: ALICE, requester: 3 }));
      await expectError("SHARE_CODE_INVALID", () => exchange.redeemShareCode({ code, wallet: BOB, requester: 3 }));
      await expectError("SHARE_CODE_INVALID", () => exchange.redeemShareCode({ code: undefined, wallet: ALICE, requester: 3 }));
    });

    it("rejects any caller but the target exchange (BlockID cannot read the data), and keeps the code usable", async () => {
      const { code } = exchange.createShareCode({ wallet: ALICE, targetClientId: 3 });
      await expectError("SHARE_CODE_WRONG_REQUESTER", () => exchange.redeemShareCode({ code, wallet: ALICE, requester: 2 }));
      await expectError("SHARE_CODE_WRONG_REQUESTER", () => exchange.redeemShareCode({ code, wallet: ALICE, requester: undefined }));
      expect(exchange.redeemShareCode({ code, wallet: ALICE, requester: 3 }).salt).to.equal(SALT.toString());
    });

    it("will not issue a code for a wallet without an identity", async () => {
      await expectError("NO_KYC_RECORD", () => exchange.createShareCode({ wallet: BOB, targetClientId: 3 }));
    });
  });
});

describe("Exchange (target side)", () => {
  let chain, network, source, target, requestId;

  // Exchange 1 is the source, exchange 3 the target; request 1 is recorded on the fake chain.
  beforeEach(async () => {
    chain = new FakeChain();
    ["Exchange 1", "Exchange 2", "Exchange 3"].forEach((name) => chain.addClient(name));
    network = new MemoryNetwork();
    source = network.add(new Exchange({ clientId: 1, artifacts }));
    target = network.add(new Exchange({ clientId: 3, artifacts, chain, transport: network.exchange(3) }));
    source.storeKyc({ wallet: ALICE, identity: IDENTITY, salt: SALT });

    chain.grant(ALICE, 1);
    chain.grant(ALICE, 2);
    requestId = chain.request(ALICE, 3);
    const answer = await source.provideProof({ wallet: ALICE, nonce: requestId });
    await chain.recordSync({ requestId, sourceClientId: 1, proofs: [{ pubSignals: answer.publicSignals }] });
  });

  const receive = (overrides = {}) =>
    target.receiveShare({
      requestId,
      wallet: ALICE,
      source: { id: 1 },
      code: source.createShareCode({ wallet: ALICE, targetClientId: 3 }).code,
      ...overrides,
    });

  it("fetches the identity from the source and stores it when it matches the on-chain commitment", async () => {
    await receive();
    expect(target.getRecord(ALICE)).to.deep.equal({ identity: IDENTITY, salt: SALT.toString(), source: "blockid:1" });
  });

  it("can prove the received identity itself afterwards (it has the salt)", async () => {
    await receive();
    const answer = await target.provideProof({ wallet: ALICE, nonce: 9 });
    expect(parsePublicSignals(answer.publicSignals).identityCommitment).to.equal(identityCommitment(IDENTITY, SALT));
  });

  it("rejects data that does not match the on-chain commitment, and stores nothing", async () => {
    // The source's record changed after it proved the old one.
    source.storeKyc({ wallet: ALICE, identity: { ...IDENTITY, identityNumber: "99999999999" }, salt: SALT });
    await expectError("DATA_MISMATCH", () => receive());
    expect(target.hasRecord(ALICE)).to.equal(false);
  });

  it("rejects a source other than the one recorded on-chain", async () => {
    await expectError("SYNC_MISMATCH", () => receive({ source: { id: 2 } }));
  });

  it("rejects a wallet other than the one recorded on-chain", async () => {
    source.storeKyc({ wallet: BOB, identity: IDENTITY, salt: SALT });
    await expectError("SYNC_MISMATCH", () =>
      receive({ wallet: BOB, code: source.createShareCode({ wallet: BOB, targetClientId: 3 }).code }),
    );
  });

  it("rejects when the on-chain sync was made for another target", async () => {
    const other = network.add(new Exchange({ clientId: 2, artifacts, chain, transport: network.exchange(2) }));
    await expectError("SYNC_MISMATCH", () =>
      other.receiveShare({ requestId, wallet: ALICE, source: { id: 1 }, code: "x" }),
    );
  });

  it("rejects a reused share code", async () => {
    const { code } = source.createShareCode({ wallet: ALICE, targetClientId: 3 });
    await receive({ code });
    await expectError("SHARE_CODE_USED", () => receive({ code }));
  });

  it("rejects a request that was never recorded", async () => {
    const pending = chain.request(ALICE, 3);
    await expectError("REQUEST_NOT_FOUND", () => receive({ requestId: pending }));
  });
});
