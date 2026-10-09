import { BlockIdError } from "./errors.js";
import { requireId } from "./field.js";

const REQUEST_NOT_FOUND = "UnknownRequest";

/**
 * Wrap an ethers v6 Contract of BlockID in the small `chain` interface the Orchestrator and
 * the Exchange use. Pass the contract connected to the orchestrator's signer if you want
 * recordSync; a read-only provider is enough for everything else.
 *
 * The module does not import ethers: any object with the same methods works (a viem
 * wrapper, a test double, ...).
 */
export function createChain(contract) {
  const lower = (address) => address.toLowerCase();

  // The custom error a failed call reverted with, if the ABI knows it. ethers fills
  // `error.revert` itself; some providers only hand over the raw return data.
  const revertOf = (error) => {
    if (error?.revert?.name) return error.revert;
    const data = error?.data ?? error?.info?.error?.data ?? error?.error?.data;
    try {
      return typeof data === "string" ? contract.interface.parseError(data) : undefined;
    } catch {
      return undefined;
    }
  };

  const read = async (call) => {
    try {
      return await call();
    } catch (error) {
      const revert = revertOf(error);
      if (revert?.name === REQUEST_NOT_FOUND) {
        throw new BlockIdError("REQUEST_NOT_FOUND", `request ${revert.args?.[0]} does not exist`, {
          requestId: Number(revert.args?.[0]),
        });
      }
      throw error;
    }
  };

  return {
    minSources: async () => Number(await contract.minSources()),

    getRequest: (requestId) =>
      read(async () => {
        const [wallet, targetClientId, fulfilled] = await contract.getRequest(requestId);
        return { wallet: lower(wallet), targetClientId: Number(targetClientId), fulfilled };
      }),

    getGrants: async (wallet) => (await contract.getGrants(wallet)).map(Number),

    getClient: async (clientId) => {
      const id = requireId("clientId", clientId);
      const [name, url] = await contract.getClient(id);
      return { id, name, url };
    },

    /** The recorded result of a fulfilled request. Throws if the request is not synced yet. */
    getSync: (requestId) =>
      read(async () => {
        const [wallet, sourceClientId, targetClientId, commitment] = await contract.getSync(requestId);
        return {
          wallet: lower(wallet),
          sourceClientId: Number(sourceClientId),
          targetClientId: Number(targetClientId),
          identityCommitment: BigInt(commitment),
        };
      }),

    recordSync: async ({ requestId, sourceClientId, proofs }) => {
      const tx = await contract.recordSync(requestId, sourceClientId, proofs);
      const receipt = await tx.wait();
      return { txHash: receipt.hash };
    },

    /** Calls `handler(requestId, { wallet, targetClientId })` for each IdentityRequested event. */
    onIdentityRequested: (handler) => {
      const listener = (wallet, targetClientId, requestId) =>
        handler(Number(requestId), { wallet: lower(wallet), targetClientId: Number(targetClientId) });
      contract.on("IdentityRequested", listener);
      return () => contract.off("IdentityRequested", listener);
    },
  };
}
