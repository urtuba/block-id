import { identityCommitment, requireSalt } from "./commitment.js";
import { BlockIdError } from "./errors.js";
import { IDENTITY_FIELDS, normalizeAddress, requireId } from "./field.js";
import { proveIdentity } from "./proof.js";

const FIVE_MINUTES = 5 * 60 * 1000;

const defaultRandomHex = (byteLength) =>
  Array.from(globalThis.crypto.getRandomValues(new Uint8Array(byteLength)), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * One exchange (a KYC provider such as Hinance). Environment-agnostic: it keeps its
 * records in memory and gets everything else injected, so the same class runs in a test,
 * in the browser demo, or behind an HTTP server that stores records in a database.
 *
 * As a SOURCE it answers BlockID's proof requests and hands out share codes. As a TARGET
 * it fetches an identity from a source with a code and checks it against the chain.
 *
 * Trust: the exchange is trusted to hold correct data and to authenticate its callers.
 * `requester` in redeemShareCode must come from the transport's authentication (a signed
 * request, mTLS, ...), never from the request body.
 */
export class Exchange {
  /**
   * @param {object} options
   * @param {number} options.clientId id in the BlockID contract
   * @param {{wasm: string|Uint8Array, zkey: string|Uint8Array}} options.artifacts circuit files, for proving
   * @param {object} [options.transport] needed as a target: { redeemShareCode(sourceClient, {code, wallet}) }
   * @param {object} [options.chain] needed as a target: { getSync(requestId) }
   * @param {() => number} [options.now] clock in ms, injectable for tests
   * @param {number} [options.codeTtlMs] how long a share code lives (default 5 minutes)
   * @param {(bytes: number) => string} [options.randomHex] source of share codes
   */
  constructor({ clientId, artifacts, transport, chain, now = Date.now, codeTtlMs = FIVE_MINUTES, randomHex = defaultRandomHex }) {
    this.clientId = requireId("clientId", clientId);
    this.artifacts = artifacts;
    this.transport = transport;
    this.chain = chain;
    this.now = now;
    this.codeTtlMs = codeTtlMs;
    this.randomHex = randomHex;
    this.records = new Map(); // wallet -> { identity, salt, source }
    this.codes = new Map(); // code -> { wallet, targetClientId, expiresAt, used }
  }

  // ---- KYC records ---------------------------------------------------------------

  /**
   * Store the result of a KYC check: the verified identity of the person behind `wallet`
   * and the salt the user gave this exchange. Validates the fields by committing to them.
   */
  storeKyc({ wallet, identity, salt }) {
    const key = normalizeAddress(wallet);
    const record = {
      identity: Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, identity?.[field]])),
      salt: requireSalt(salt).toString(),
      source: "kyc",
    };
    identityCommitment(record.identity, record.salt); // throws INVALID_INPUT on bad fields
    this.records.set(key, record);
  }

  hasRecord(wallet) {
    return this.records.has(normalizeAddress(wallet));
  }

  /** The stored identity and salt, or undefined. For the exchange's own use. */
  getRecord(wallet) {
    const record = this.records.get(normalizeAddress(wallet));
    return record && { identity: { ...record.identity }, salt: record.salt, source: record.source };
  }

  #requireRecord(wallet) {
    const record = this.records.get(normalizeAddress(wallet));
    if (!record) {
      throw new BlockIdError("NO_KYC_RECORD", `exchange ${this.clientId} has no identity for ${wallet}`, {
        clientId: this.clientId,
        wallet,
      });
    }
    return record;
  }

  // ---- source side ---------------------------------------------------------------

  /**
   * Answer BlockID's request for a proof. The proof says "this exchange knows the identity
   * behind identityCommitment" for this wallet and this request, and nothing more.
   */
  async provideProof({ wallet, nonce }) {
    const record = this.#requireRecord(wallet);
    const { proof, publicSignals } = await proveIdentity({
      identity: record.identity,
      salt: record.salt,
      wallet,
      clientId: this.clientId,
      nonce,
      artifacts: this.artifacts,
    });
    return { clientId: this.clientId, proof, publicSignals };
  }

  /**
   * Issue a one-time share code for `wallet`, redeemable only by the exchange
   * `targetClientId`, until it expires. BlockID hands the code to the target. Because the
   * code is bound to the target, BlockID cannot use it to read the data itself.
   */
  createShareCode({ wallet, targetClientId }) {
    const key = normalizeAddress(wallet);
    this.#requireRecord(key);
    const code = this.randomHex(16);
    const expiresAt = this.now() + this.codeTtlMs;
    this.codes.set(code, { wallet: key, targetClientId: requireId("targetClientId", targetClientId), expiresAt, used: false });
    return { code, expiresAt };
  }

  /**
   * Redeem a share code: returns the identity and salt, once. Throws SHARE_CODE_INVALID
   * (unknown code or other wallet), SHARE_CODE_WRONG_REQUESTER, SHARE_CODE_USED or
   * SHARE_CODE_EXPIRED.
   * @param {object} args
   * @param {string} args.code
   * @param {string} args.wallet
   * @param {number} args.requester the AUTHENTICATED client id of the caller
   */
  redeemShareCode({ code, wallet, requester }) {
    const entry = typeof code === "string" ? this.codes.get(code) : undefined;
    if (!entry || entry.wallet !== normalizeAddress(wallet)) {
      throw new BlockIdError("SHARE_CODE_INVALID", "unknown share code", { clientId: this.clientId });
    }
    if (entry.targetClientId !== requester) {
      throw new BlockIdError("SHARE_CODE_WRONG_REQUESTER", "this share code was issued for another exchange", {
        clientId: this.clientId,
      });
    }
    if (entry.used) throw new BlockIdError("SHARE_CODE_USED", "share code already used", { clientId: this.clientId });
    if (this.now() >= entry.expiresAt) {
      throw new BlockIdError("SHARE_CODE_EXPIRED", "share code expired", { clientId: this.clientId });
    }
    entry.used = true;
    const record = this.#requireRecord(entry.wallet);
    return { identity: { ...record.identity }, salt: record.salt };
  }

  // ---- target side ---------------------------------------------------------------

  /**
   * BlockID tells this exchange (the target) where to fetch an identity. The exchange does
   * not trust BlockID's word: it reads the sync record from the chain, fetches the data
   * from the source named there, and stores it only if Poseidon(data, salt) equals the
   * commitment that the on-chain proofs were made for.
   *
   * @param {object} args
   * @param {number} args.requestId the on-chain request
   * @param {string} args.wallet
   * @param {{id: number}} args.source the source exchange BlockID picked (a client record)
   * @param {string} args.code the share code from that source
   */
  async receiveShare({ requestId, wallet, source, code }) {
    const key = normalizeAddress(wallet);
    const sync = await this.chain.getSync(requestId);
    if (
      sync.wallet !== key ||
      sync.targetClientId !== this.clientId ||
      sync.sourceClientId !== source.id
    ) {
      throw new BlockIdError("SYNC_MISMATCH", "the on-chain sync is not for this wallet, source and exchange", {
        requestId,
        onChain: { wallet: sync.wallet, sourceClientId: sync.sourceClientId, targetClientId: sync.targetClientId },
      });
    }

    const { identity, salt } = await this.transport.redeemShareCode(source, { code, wallet: key });
    if (identityCommitment(identity, salt) !== sync.identityCommitment) {
      throw new BlockIdError("DATA_MISMATCH", "the received identity does not match the on-chain commitment", {
        requestId,
        sourceClientId: source.id,
      });
    }

    this.records.set(key, {
      identity: Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, identity[field]])),
      salt: requireSalt(salt).toString(),
      source: `blockid:${source.id}`,
    });
  }
}
