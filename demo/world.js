// The world of the demo: a chain with the BlockID contract on it, three exchanges and the
// BlockID orchestrator, wired together with the protocol module (block-id-sdk) and nothing
// else. This file knows no browser APIs and no DOM, so the page and the Node tests build the
// very same world. What differs is injected: `ethers`, a `provider`, and how to `fund` an
// address (the page uses an in-browser EVM, the tests use Hardhat).
//
// Every call that crosses a boundary of the protocol (BlockID -> exchange, BlockID ->
// chain, exchange 3 -> chain, exchange 3 -> source) goes through a thin wrapper here that
// writes a line to the log. The wrappers add nothing to the protocol: they only watch it,
// and they can pause it (`world.gate`), which is how the page walks through the steps.
import {
  Exchange,
  MemoryNetwork,
  Orchestrator,
  createChain,
} from "../block-id-sdk/src/index.js";
import { blockIdAbi, blockIdBytecode, verifierAbi, verifierBytecode } from "../contracts/contract-data.js";

/** The three exchanges of the story. Fictional names; the ids are the ids in the contract. */
export const EXCHANGES = [
  { id: 1, name: "Violex", url: "https://violex.example" },
  { id: 2, name: "Mintex", url: "https://mintex.example" },
  { id: 3, name: "Hinance", url: "https://hinance.example" },
];

export const exchangeName = (id) => EXCHANGES.find((exchange) => exchange.id === id)?.name ?? `Exchange ${id}`;

/** 0x1234abcd...ef56 */
export const short = (value, head = 8, tail = 4) => {
  const text = String(value);
  return text.length <= head + tail + 1 ? text : `${text.slice(0, head)}…${text.slice(-tail)}`;
};

const seconds = (ms) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

/**
 * Build the world.
 *
 * @param {object} options
 * @param {object} options.ethers the ethers v6 namespace
 * @param {object} options.provider an ethers provider for the chain
 * @param {(address: string) => Promise<void>} options.fund give an address test ETH
 * @param {{wasm: Uint8Array|string, zkey: Uint8Array|string}} options.artifacts circuit files
 * @param {object} options.vkey verification key (circuits/artifacts/vkey.json)
 * @param {(sources: object[]) => object} [options.selectSource] which source BlockID uses
 */
export async function createWorld({ ethers, provider, fund, artifacts, vkey, selectSource }) {
  const listeners = new Set();
  const world = {
    ethers,
    provider,
    artifacts,
    vkey,
    /** what BlockID's side of the network received: proofs and share codes, never data */
    seen: [],
    /** story hook: `await world.gate(step)` pauses the protocol until the story lets it go */
    gate: async () => {},
    /** story hook: runs just before BlockID records a sync on-chain */
    beforeRecordSync: async () => {},
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Write one line to the step log. `actor`: wallet, ex1, ex2, ex3, blockid or chain. */
    say(actor, text, extra = {}) {
      const entry = { actor, text, at: Date.now(), ...extra };
      listeners.forEach((listener) => listener(entry));
      return entry;
    },
  };
  const say = (...args) => world.say(...args);

  // ---- accounts --------------------------------------------------------------------
  // Keys are made here, held in memory and never written anywhere. They are test keys for
  // a chain that exists only in this page (or in the test process).
  const newWallet = async () => {
    const wallet = new ethers.Wallet(ethers.hexlify(ethers.randomBytes(32)), provider);
    await fund(wallet.address);
    return wallet;
  };
  const owner = await newWallet();
  const orchestratorWallet = await newWallet();
  world.newWallet = newWallet;

  // ---- contracts -------------------------------------------------------------------
  const verifier = await new ethers.ContractFactory(verifierAbi, verifierBytecode, owner).deploy();
  await verifier.waitForDeployment();
  const blockId = await new ethers.ContractFactory(blockIdAbi, blockIdBytecode, owner).deploy(
    await verifier.getAddress(),
    orchestratorWallet.address,
    2,
  );
  await blockId.waitForDeployment();
  for (const { name, url } of EXCHANGES) await (await blockId.addClient(name, url)).wait();
  world.blockId = blockId;
  world.verifierAddress = await verifier.getAddress();
  world.blockIdAddress = await blockId.getAddress();
  world.orchestratorWallet = orchestratorWallet;

  /** The chain as the protocol module sees it, signed by the orchestrator. */
  world.rawChain = createChain(blockId.connect(orchestratorWallet));
  const readChain = createChain(blockId.connect(provider));

  // ---- the BlockID side, with its eyes open ------------------------------------------
  const network = new MemoryNetwork();
  const honest = network.blockId();
  world.network = network;

  const proofClock = { gate: null, mark: 0 };
  const nameOf = (client) => client.name ?? exchangeName(client.id);

  const transport = {
    requestProof: async (client, args) => {
      // One gate for all the proofs of a request: they are asked for together.
      proofClock.gate ??= (async () => {
        say("blockid", `BlockID's orchestrator sees the IdentityRequested event for request #${args.nonce} and reads the wallet's grants from the chain.`);
        await world.gate("proofs");
        proofClock.mark = performance.now();
      })();
      await proofClock.gate;
      say("blockid", `BlockID asks ${nameOf(client)} for a proof (wallet ${short(args.wallet, 6, 4)}, nonce ${args.nonce}).`);
      const answer = await honest.requestProof(client, args);
      const now = performance.now();
      const took = now - proofClock.mark; // proofs are made one after another, so this is this proof
      proofClock.mark = now;
      world.seen.push({ kind: "proof", from: client.id, answer });
      say(`ex${client.id}`, `${nameOf(client)} sends a Groth16 proof, made in the browser in ${seconds(took)}. It carries four public numbers: the identity commitment ${short(answer.publicSignals[0], 6, 4)}, the wallet, its own exchange id and the request id.`, {
        ms: Math.round(took),
      });
      return answer;
    },

    createShareCode: async (client, args) => {
      const proofs = world.seen.filter((item) => item.kind === "proof");
      say("blockid", `BlockID verified ${proofs.length} proofs off-chain. Each is for this wallet, this request and its own exchange, and all show the same commitment.`);
      await world.gate("share");
      const answer = await honest.createShareCode(client, args);
      world.seen.push({ kind: "share code", from: client.id, answer });
      say(`ex${client.id}`, `${nameOf(client)} issues a one-time share code (${answer.code.slice(0, 6)}…). Only ${exchangeName(args.targetClientId)} can redeem it, once, within 5 minutes. BlockID cannot use it.`);
      return answer;
    },

    notifyTarget: async (client, args) => {
      await world.gate("redeem");
      say("blockid", `BlockID tells ${nameOf(client)} to fetch the identity from ${exchangeName(args.source.id)}.`);
      await honest.notifyTarget(client, args);
      say(`ex${client.id}`, `${nameOf(client)} checked Poseidon(data, salt) against the commitment on the chain. It matches, so ${nameOf(client)} keeps the identity.`, { ok: true });
    },
  };

  const chain = {
    ...world.rawChain,
    recordSync: async (args) => {
      await world.gate("record");
      await world.beforeRecordSync(args);
      say("blockid", `BlockID sends recordSync for request #${args.requestId} with ${args.proofs.length} proofs.`);
      const { txHash } = await world.rawChain.recordSync(args);
      const receipt = await provider.getTransactionReceipt(txHash);
      world.lastSync = { txHash, gasUsed: receipt.gasUsed };
      say("chain", `The contract verified ${args.proofs.length} Groth16 proofs on-chain, found the same commitment in both and recorded the sync. Gas used: ${Number(receipt.gasUsed).toLocaleString("en-US")}.`, { tx: txHash, ok: true });
      return { txHash };
    },
  };

  world.orchestrator = new Orchestrator({ chain, transport, vkey, selectSource });
  world.resetRequest = () => {
    proofClock.gate = null;
  };

  // ---- the exchanges ---------------------------------------------------------------
  // Exchange 3 is the target, so it reads the chain and fetches from sources. Its two
  // wrappers only log.
  const ex3Chain = {
    getSync: async (requestId) => {
      const sync = await readChain.getSync(requestId);
      say("ex3", `${exchangeName(3)} reads the sync record of request #${requestId} from the chain. It names ${exchangeName(sync.sourceClientId)} as the source and holds commitment ${short(sync.identityCommitment, 6, 4)}.`);
      return sync;
    },
  };
  const exchangeTransport = (id) => {
    const real = network.exchange(id);
    return {
      redeemShareCode: async (client, args) => {
        say(`ex${id}`, `${exchangeName(id)} redeems the share code at ${nameOf(client)}. The data goes from exchange to exchange, not through BlockID.`);
        return real.redeemShareCode(client, args);
      },
    };
  };
  world.exchanges = Object.fromEntries(
    EXCHANGES.map(({ id }) => [
      id,
      network.add(new Exchange({ clientId: id, artifacts, chain: id === 3 ? ex3Chain : readChain, transport: exchangeTransport(id) })),
    ]),
  );

  return world;
}
