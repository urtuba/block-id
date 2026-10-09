/**
 * Every error the protocol module throws on purpose. `code` is a stable string to branch
 * on; `details` carries ids and values for logs.
 *
 * Codes:
 *   INVALID_INPUT          a value is malformed (address, date, empty text, ...)
 *   NO_KYC_RECORD          the exchange has no identity for this wallet
 *   SHARE_CODE_INVALID     unknown code, or a code for another wallet
 *   SHARE_CODE_USED        the code was redeemed already
 *   SHARE_CODE_EXPIRED     the code is past its expiry
 *   SHARE_CODE_WRONG_REQUESTER  the caller is not the exchange the code was issued for
 *   REQUEST_NOT_FOUND      no such request on-chain
 *   ALREADY_SYNCED         the request is already fulfilled
 *   NOT_ENOUGH_SOURCES     the wallet granted too few source exchanges
 *   NOT_ENOUGH_PROOFS      too few sources answered with a proof
 *   PROOF_BINDING          a proof is for another wallet, request or exchange
 *   PROOF_INVALID          a proof does not verify
 *   IDENTITY_MISMATCH      the sources hold different identities
 *   SYNC_MISMATCH          the on-chain sync record does not match what a source sent
 *   DATA_MISMATCH          the received identity data does not match the on-chain commitment
 */
export class BlockIdError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BlockIdError";
    this.code = code;
    this.details = details;
  }
}
