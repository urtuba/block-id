import { BlockIdError } from "./errors.js";
import { normalizeAddress } from "./field.js";
import { parsePublicSignals, proofToCalldata, verifyIdentityProof } from "./proof.js";

const randomPick = (items) => items[globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % items.length];

/**
 * The BlockID side of the protocol. It never sees identity data: only proofs, the
 * commitments inside them, and share codes (which only the target exchange can redeem).
 *
 * Everything outside the module is injected:
 *
 *   chain (reads and writes the BlockID contract; see createChain in chain.js)
 *     minSources()                      -> number
 *     getRequest(requestId)             -> { wallet, targetClientId, fulfilled }
 *     getGrants(wallet)                 -> number[]
 *     getClient(clientId)               -> { id, name, url }
 *     recordSync({ requestId, sourceClientId, proofs }) -> { txHash }   proofs: contract calldata
 *     onIdentityRequested(handler)      -> unsubscribe        (only for watch())
 *
 *   transport (talks to exchanges; HTTP in a real deployment, MemoryNetwork in tests)
 *     requestProof(client, { wallet, nonce })                -> { clientId, proof, publicSignals }
 *     createShareCode(client, { wallet, targetClientId })    -> { code, expiresAt }
 *     notifyTarget(client, { requestId, wallet, source, code })
 *
 *   vkey  the verification key (circuits/artifacts/vkey.json)
 */
export class Orchestrator {
  constructor({ chain, transport, vkey, selectSource = randomPick }) {
    this.chain = chain;
    this.transport = transport;
    this.vkey = vkey;
    this.selectSource = selectSource;
  }

  /**
   * Run the protocol for one request:
   *  1. read the request and the wallet's granted sources from the chain
   *  2. ask every source for a proof bound to (wallet, source, request id)
   *  3. check each proof's binding and verify it; check all commitments are equal
   *  4. pick a source and get a short-lived share code from it
   *  5. record the sync on-chain (the contract verifies the proofs again)
   *  6. hand the target exchange the source and the code
   *
   * Throws a BlockIdError and changes nothing on-chain when a check fails. The target is
   * told only after the chain accepted the sync.
   */
  async handleRequest(requestId) {
    const request = await this.chain.getRequest(requestId);
    const wallet = normalizeAddress(request.wallet);
    if (request.fulfilled) throw new BlockIdError("ALREADY_SYNCED", `request ${requestId} is already synced`, { requestId });

    const minSources = await this.chain.minSources();
    const granted = await this.chain.getGrants(wallet);
    const sourceIds = granted.filter((id) => id !== request.targetClientId).sort((a, b) => a - b);
    if (sourceIds.length < minSources) {
      throw new BlockIdError("NOT_ENOUGH_SOURCES", `wallet granted ${sourceIds.length} sources, ${minSources} needed`, { requestId });
    }

    const sources = await Promise.all(sourceIds.map((id) => this.chain.getClient(id)));
    const answers = await Promise.all(sources.map((client) => this.#collectProof(client, { wallet, requestId })));

    // A source that cannot answer (no record, unreachable) is skipped. A proof that is
    // wrong is not: it stops the sync.
    const proven = answers.filter((answer) => answer.proof);
    const skipped = answers.filter((answer) => !answer.proof).map(({ client, error }) => ({ clientId: client.id, error }));
    if (proven.length < minSources) {
      throw new BlockIdError("NOT_ENOUGH_PROOFS", `${proven.length} sources answered with a proof, ${minSources} needed`, {
        requestId,
        skipped,
      });
    }

    for (const { client, proof } of proven) await this.#checkProof(client, proof, { wallet, requestId });

    const commitments = new Set(proven.map(({ proof }) => parsePublicSignals(proof.publicSignals).identityCommitment));
    if (commitments.size !== 1) {
      throw new BlockIdError("IDENTITY_MISMATCH", "the sources do not hold the same identity", {
        requestId,
        clientIds: proven.map(({ client }) => client.id),
      });
    }
    const [identityCommitment] = commitments;

    const source = this.selectSource(proven.map(({ client }) => client));
    const { code } = await this.transport.createShareCode(source, { wallet, targetClientId: request.targetClientId });

    const { txHash } = await this.chain.recordSync({
      requestId,
      sourceClientId: source.id,
      proofs: proven.map(({ proof }) => proofToCalldata(proof)),
    });

    const target = await this.chain.getClient(request.targetClientId);
    await this.transport.notifyTarget(target, { requestId, wallet, source, code });

    return {
      requestId,
      wallet,
      identityCommitment,
      sourceClientId: source.id,
      targetClientId: request.targetClientId,
      provenClientIds: proven.map(({ client }) => client.id),
      skipped,
      txHash,
    };
  }

  /**
   * Handle every IdentityRequested event the chain reports. `onResult` and `onError` get
   * the outcome of each request. Returns a function that stops watching.
   */
  watch({ onResult = () => {}, onError = () => {} } = {}) {
    return this.chain.onIdentityRequested((requestId) => {
      this.handleRequest(requestId).then(onResult, (error) => onError(error, requestId));
    });
  }

  async #collectProof(client, { wallet, requestId }) {
    try {
      return { client, proof: await this.transport.requestProof(client, { wallet, nonce: requestId }) };
    } catch (error) {
      return { client, error: error?.code ?? "SOURCE_UNREACHABLE" };
    }
  }

  async #checkProof(client, proof, { wallet, requestId }) {
    const binding = { requestId, clientId: client.id };
    const signals = parsePublicSignals(proof.publicSignals);
    if (signals.wallet !== wallet) throw new BlockIdError("PROOF_BINDING", `proof of exchange ${client.id} is for another wallet`, binding);
    if (signals.nonce !== requestId) throw new BlockIdError("PROOF_BINDING", `proof of exchange ${client.id} is for another request`, binding);
    if (signals.clientId !== client.id) throw new BlockIdError("PROOF_BINDING", `proof of exchange ${client.id} is made for another exchange`, binding);
    if (!(await verifyIdentityProof(this.vkey, proof))) {
      throw new BlockIdError("PROOF_INVALID", `proof of exchange ${client.id} does not verify`, binding);
    }
  }
}
