import { BlockIdError } from "./errors.js";

/**
 * An in-memory network of exchanges: the transport for tests and for the browser demo.
 * A real deployment replaces it with HTTP calls to each exchange's `url`; the interface
 * stays the same.
 *
 *   const network = new MemoryNetwork();
 *   network.add(exchange1); network.add(exchange2); network.add(exchange3);
 *   new Orchestrator({ chain, vkey, transport: network.blockId() });
 *   // and for the target side: new Exchange({ ..., transport: network.exchange(3) })
 *
 * The transport authenticates the caller: `exchange(id)` is a view that always passes `id`
 * as the requester, as a real transport would with a signed request.
 */
export class MemoryNetwork {
  constructor() {
    this.exchanges = new Map();
  }

  add(exchange) {
    this.exchanges.set(exchange.clientId, exchange);
    return exchange;
  }

  #get(client) {
    const exchange = this.exchanges.get(client.id);
    if (!exchange) throw new BlockIdError("SOURCE_UNREACHABLE", `no exchange ${client.id} on this network`, { clientId: client.id });
    return exchange;
  }

  /** What the BlockID orchestrator uses to reach exchanges. */
  blockId() {
    return {
      requestProof: async (client, { wallet, nonce }) => this.#get(client).provideProof({ wallet, nonce }),
      createShareCode: async (client, { wallet, targetClientId }) => this.#get(client).createShareCode({ wallet, targetClientId }),
      notifyTarget: async (client, { requestId, wallet, source, code }) =>
        this.#get(client).receiveShare({ requestId, wallet, source, code }),
    };
  }

  /** What exchange `requesterId` uses to fetch data from a source exchange. */
  exchange(requesterId) {
    return {
      redeemShareCode: async (client, { code, wallet }) =>
        this.#get(client).redeemShareCode({ code, wallet, requester: requesterId }),
    };
  }
}
