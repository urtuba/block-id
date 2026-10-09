// The chain of the demo: a small EVM that runs inside the visitor's browser, with ethers
// v6 on top. Nothing is sent to any network. Tevm (https://tevm.sh) gives the EVM and an
// EIP-1193 provider, the same way tweet-verifier uses it. The packages come from the import
// map in index.html (exact versions on jsDelivr).
import * as ethers from "ethers";
import { createTevmNode } from "@tevm/node";
import { requestEip1193 } from "@tevm/decorators";

const HUNDRED_ETH = ethers.toQuantity(100n * 10n ** 18n);

// Tevm's gas estimate is too low for a transaction that clears storage (revoke): it does
// not count the gas the EVM needs before the refund, and the transaction then runs out of
// gas. Leave room above the estimate, as tweet-verifier does. The gas a transaction really
// used is what its receipt reports, so the numbers shown in the log are not affected.
class DemoProvider extends ethers.BrowserProvider {
  async estimateGas(transaction) {
    return ((await super.estimateGas(transaction)) * 3n) / 2n;
  }
}

/**
 * Start the EVM. Resolves with what createWorld (world.js) needs: `ethers`, a `provider`
 * and `fund(address)`, which gives an address test ETH on this chain only.
 */
export async function startEvm() {
  const node = createTevmNode().extend(requestEip1193());
  await node.ready();
  // cacheTimeout -1: ethers would otherwise answer a second "transaction count" from its
  // cache for 250 ms and send a transaction with a nonce that is already used.
  const provider = new DemoProvider(node, undefined, { cacheTimeout: -1 });
  const fund = (address) => provider.send("anvil_setBalance", [address, HUNDRED_ETH]);
  return { ethers, provider, fund };
}
