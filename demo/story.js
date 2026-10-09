// The story of the demo, as a script over the world (world.js). It follows the sequence
// diagram in the README: KYC at two exchanges, a grant for each, a sign-up at the third,
// the request, the proofs, the sync, the hand-over. Every action is a real call to the
// protocol module or the contract. The story adds only the narration, the pauses and, for
// the "break it" runs, one deliberate change per run.
//
// Like world.js it knows no browser APIs, so the Node tests run the same script.
import {
  SALT_MESSAGE,
  deriveSalt,
  encodeIdentity,
  identityCommitment,
  proofToCalldata,
  verifyIdentityProof,
  Orchestrator,
} from "../block-id-sdk/src/index.js";
import { exchangeName, short } from "./world.js";

const [EX1, EX2, EX3] = [1, 2, 3];

/**
 * The steps of the guided story, in order. `label` says what happens when the visitor
 * clicks "Next step". The first six are the story's own; the last four are pauses that
 * world.js puts inside BlockID's work (`world.gate(id)`).
 */
export const STEPS = [
  { id: "wallet", label: "Create a demo wallet" },
  { id: "kyc1", label: `Do KYC at ${exchangeName(EX1)}` },
  { id: "grant1", label: `Grant ${exchangeName(EX1)} as a source` },
  { id: "kyc2", label: `Do KYC at ${exchangeName(EX2)}` },
  { id: "grant2", label: `Grant ${exchangeName(EX2)} as a source` },
  { id: "request", label: `Sign up at ${exchangeName(EX3)} and click “Continue with BlockID”` },
  { id: "proofs", label: `BlockID asks ${exchangeName(EX1)} and ${exchangeName(EX2)} for proofs` },
  { id: "share", label: "BlockID asks one source for a share code" },
  { id: "record", label: "BlockID records the sync on the chain" },
  { id: "redeem", label: `${exchangeName(EX3)} fetches the identity and checks it` },
];

/** The "break it" runs. Each starts from a fresh world. */
export const SCENARIOS = [
  {
    id: "dob",
    title: "Exchange 2 has another date of birth",
    summary: `${exchangeName(EX2)} holds the date of birth one day off. The commitments differ, so the two exchanges do not hold the same identity.`,
  },
  {
    id: "replay",
    title: "Replay an old proof",
    summary: "A valid proof from the first request is sent again for a new request.",
  },
  {
    id: "revoke",
    title: `The user revokes ${exchangeName(EX2)} in time`,
    summary: `The user takes ${exchangeName(EX2)}'s grant back while BlockID is already working on the request.`,
  },
];

const CONTRACT_ERRORS = {
  CommitmentMismatch:
    "The proofs show different identity commitments, so the exchanges hold different data about this person. The contract refuses to record a sync.",
  WrongNonce:
    "Every proof carries the id of the request it was made for. This one was made for an earlier request, so the contract refuses it. An old proof cannot be reused.",
  NotGranted:
    "The contract checks the user's grants at the moment it records the sync, not when the request was made. The user had taken this exchange's grant back.",
  WrongWallet: "The proof was made for another wallet.",
  InvalidProof: "The Groth16 proof does not verify.",
};

const MODULE_ERRORS = {
  IDENTITY_MISMATCH:
    "BlockID compared the identity commitments in the proofs and found two different ones. It stops before it asks for a share code or writes anything to the chain.",
  PROOF_BINDING:
    "BlockID checks the public numbers of every proof. This proof is for another request than the one being handled, so BlockID drops it before the chain sees it.",
  NOT_ENOUGH_SOURCES: "Fewer than two granted sources are left.",
};

/**
 * The custom error a failed call reverted with. ethers decodes it itself for calls that
 * only read; for a transaction it leaves the raw return data on the error, in a spot that
 * depends on the node (the in-page EVM nests it one level deeper than Hardhat), so look in
 * each spot and decode with the contract's ABI.
 */
function decodeRevert(error, contractInterface) {
  const spots = [error?.data, error?.info?.error?.data, error?.info?.error?.data?.data, error?.error?.data, error?.error?.data?.data];
  const data = spots.find((spot) => typeof spot === "string" && /^0x[0-9a-fA-F]{8,}$/.test(spot));
  try {
    return data && contractInterface ? contractInterface.parseError(data) : null;
  } catch {
    return null;
  }
}

/**
 * Turn whatever a failed step threw into something to show: where it was rejected, the
 * exact error, and a plain-English reason.
 * @returns {{layer: string, label: string, name: string, args: string[], explanation: string}}
 */
export function describeError(error, contractInterface) {
  if (error?.name === "BlockIdError") {
    return {
      layer: "BlockID's code (the protocol module)",
      label: error.code,
      name: error.code,
      args: [],
      message: error.message,
      explanation: MODULE_ERRORS[error.code] ?? error.message,
    };
  }
  const revert = error?.revert ?? decodeRevert(error, contractInterface);
  if (revert?.name) {
    const args = Array.from(revert.args ?? [], String);
    return {
      layer: "The BlockID smart contract",
      label: `${revert.name}(${args.join(", ")})`,
      name: revert.name,
      args,
      message: error.shortMessage ?? error.message,
      explanation: CONTRACT_ERRORS[revert.name] ?? "The contract refused the call.",
    };
  }
  return {
    layer: "Unexpected error",
    label: error?.code ?? error?.name ?? "Error",
    name: error?.code ?? error?.name ?? "Error",
    args: [],
    message: String(error?.shortMessage ?? error?.message ?? error),
    explanation: `This is not one of the rejections the demo expects. ${String(error?.shortMessage ?? error?.message ?? error).slice(0, 300)}`,
  };
}

/** A date "YYYY-MM-DD" one day later. */
const nextDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

export class Story {
  #release = null;

  /**
   * @param {object} options
   * @param {object} options.world from createWorld
   * @param {{fullName: string, identityNumber: string, nationality: string, dateOfBirth: string}} options.identity
   * @param {"dob"|"replay"|"revoke"|null} [options.scenario] one deliberate change; null is the happy path
   * @param {boolean} [options.auto] true: no pauses
   * @param {() => void} [options.onChange] called when `view` changed
   */
  constructor({ world, identity, scenario = null, auto = false, onChange = () => {} }) {
    this.world = world;
    this.identity = identity;
    this.scenario = scenario;
    this.auto = auto;
    this.onChange = onChange;
    this.rejections = [];
    this.user = null;
    this.salt = null;
    this.requestIds = [];
    /** Everything the page shows. Plain data, replaced piece by piece. */
    this.view = {
      status: "idle", // idle, running, done (happy path finished), rejected (a run ended in a rejection)
      waiting: null, // the id of the step that waits for "Next step"
      passed: [], // gate ids that were let through
      wallet: null,
      salt: null,
      grants: [],
      records: { [EX1]: null, [EX2]: null, [EX3]: null },
      requestId: null,
      sync: null,
      seen: world.seen,
      rejections: this.rejections,
      privacy: null,
    };
    world.gate = (step) => this.#gate(step);
  }

  /** Let a waiting step go. Does nothing when no step is waiting. */
  next() {
    const release = this.#release;
    this.#release = null;
    release?.();
  }

  /** Stop pausing: finish the story in one go. */
  runAll() {
    this.auto = true;
    this.next();
  }

  async #gate(step) {
    this.view.waiting = step;
    this.#changed();
    if (!this.auto) await new Promise((resolve) => (this.#release = resolve));
    this.view.waiting = null;
    this.view.passed.push(step);
    this.#changed();
  }

  #changed() {
    this.onChange(this.view);
  }

  #say(actor, text, extra) {
    return this.world.say(actor, text, extra);
  }

  async #step(id, action) {
    await this.#gate(id);
    await action();
    this.#refreshRecords();
    this.#changed();
  }

  #refreshRecords() {
    const wallet = this.user?.address;
    for (const id of [EX1, EX2, EX3]) {
      this.view.records[id] = wallet ? this.world.exchanges[id].getRecord(wallet) ?? null : null;
    }
  }

  async #send(actor, text, pending) {
    const receipt = await (await pending).wait();
    this.#say(actor, text, { tx: receipt.hash });
    return receipt;
  }

  // ---- the run ---------------------------------------------------------------------

  /**
   * Run the story. Resolves when it is over: the sync happened (`view.status` "done"), or a
   * rejection ended it (`"rejected"`, details in `rejections`). Never throws.
   */
  async run() {
    this.view.status = "running";
    this.#changed();
    try {
      await this.#prepare();
      let synced = false;
      try {
        await this.#orchestrate();
        synced = true;
      } catch (error) {
        this.#reject(error);
      }
      if (synced && this.scenario === "replay") await this.#replay();
      else if (!synced && this.scenario === "dob") await this.#dishonestOrchestrator();
      this.view.status = this.rejections.length ? "rejected" : "done";
    } catch (error) {
      this.#reject(error);
      this.view.status = "rejected";
    }
    this.view.privacy = this.privacyCheck();
    this.#changed();
  }

  /** Steps 1 to 6: everything the user does before BlockID starts. */
  async #prepare() {
    const { world, identity } = this;

    await this.#step("wallet", async () => {
      this.user = await world.newWallet();
      this.view.wallet = this.user.address;
      this.#say("wallet", `A demo wallet is created in this page: ${short(this.user.address, 8, 6)}. Its key is random, stays in memory and is gone when you close the tab. The chain is a small EVM in this page, so the wallet got its test ETH for free.`);
    });

    const kyc = (id, data) => async () => {
      // The salt is the wallet's signature of a fixed message, turned into a number. The
      // same wallet always gives the same salt, so every exchange gets the same one.
      const salt = deriveSalt(await this.user.signMessage(SALT_MESSAGE));
      const first = this.salt === null;
      this.salt = salt;
      this.view.salt = short(salt.toString(), 6, 4);
      this.#say("wallet", first
        ? `The wallet signs a fixed message. The salt ${short(salt.toString(), 6, 4)} is derived from the signature and given to ${exchangeName(id)} with the KYC.`
        : `The wallet signs the same message again and gets the same salt, which it gives to ${exchangeName(id)}.`);
      world.exchanges[id].storeKyc({ wallet: this.user.address, identity: data, salt });
      this.#say(`ex${id}`, `${exchangeName(id)} checks the user's documents (in real life) and stores the identity and the salt. The identity commitment is ${short(identityCommitment(data, salt).toString(), 6, 4)}.`);
    };
    const grant = (id) => async () => {
      await this.#send("wallet", `The wallet calls grant(${id}): ${exchangeName(id)} may act as a source for this identity.`, world.blockId.connect(this.user).grant(id));
      this.view.grants = [...this.view.grants, id];
    };

    const identityAt2 = this.scenario === "dob" ? { ...identity, dateOfBirth: nextDay(identity.dateOfBirth) } : identity;
    await this.#step("kyc1", kyc(EX1, identity));
    await this.#step("grant1", grant(EX1));
    await this.#step("kyc2", kyc(EX2, identityAt2));
    await this.#step("grant2", grant(EX2));
    if (this.scenario === "dob") {
      this.#say("ex2", `For this run, ${exchangeName(EX2)} holds the date of birth as ${identityAt2.dateOfBirth}. Everything else is the same.`);
    }

    await this.#step("request", async () => {
      this.#say("ex3", `The user signs up at ${exchangeName(EX3)} and chooses “Continue with BlockID”.`);
      await this.#requestIdentity();
    });
  }

  /** The user calls requestIdentity on the contract. Returns the request id. */
  async #requestIdentity() {
    const { blockId } = this.world;
    const receipt = await this.#send("wallet", `The wallet calls requestIdentity(${EX3}) for ${exchangeName(EX3)}. The contract takes the caller as the wallet, so nobody can ask for someone else's identity.`, blockId.connect(this.user).requestIdentity(EX3));
    const event = receipt.logs.map((log) => blockId.interface.parseLog(log)).find((e) => e?.name === "IdentityRequested");
    const requestId = Number(event.args.requestId);
    this.requestIds.push(requestId);
    this.view.requestId = requestId;
    this.#say("chain", `The contract emits IdentityRequested(wallet, ${EX3}, ${requestId}).`);
    return requestId;
  }

  /** BlockID's side: the orchestrator handles the request the user just made. */
  async #orchestrate() {
    const { world } = this;
    const requestId = this.requestIds.at(-1);
    world.resetRequest();

    if (this.scenario === "revoke") {
      // The user acts after BlockID has its proofs and before it writes to the chain.
      world.beforeRecordSync = async () => {
        this.#say("wallet", `Before BlockID records the sync, the user changes their mind and calls revoke(${EX2}) on the contract.`);
        await this.#send("wallet", `${exchangeName(EX2)} is no longer a source for this wallet.`, world.blockId.connect(this.user).revoke(EX2));
        this.view.grants = this.view.grants.filter((id) => id !== EX2);
        this.#changed();
      };
    }

    const result = await world.orchestrator.handleRequest(requestId);
    this.#refreshRecords();
    this.view.sync = {
      requestId,
      txHash: result.txHash,
      gasUsed: Number(world.lastSync.gasUsed),
      commitment: result.identityCommitment.toString(),
      sourceClientId: result.sourceClientId,
    };
    this.#say("ex3", `Done. ${exchangeName(EX3)} has the identity of a user it never did KYC for, and BlockID never saw it.`, { ok: true });
  }

  /** Replay run: after a good sync, try the old proofs for a second request. */
  async #replay() {
    const { world } = this;
    const stale = world.seen.filter((item) => item.kind === "proof").map((item) => item.answer);
    this.#say("wallet", "Now the user makes a second request. Someone holds the two proofs of the first request and tries them again.");
    const requestId = await this.#requestIdentity();
    this.#say("blockid", `The old proof of ${exchangeName(stale[0].clientId)} is valid: it verifies against the verification key (${await verifyIdentityProof(world.vkey, stale[0])}). But its fourth public number, the request id, is ${stale[0].publicSignals[3]} and not ${requestId}.`);

    // 1. A BlockID that checks what it is given.
    const replaying = new Orchestrator({
      chain: world.rawChain,
      vkey: world.vkey,
      transport: { ...world.network.blockId(), requestProof: async (client) => stale.find((answer) => answer.clientId === client.id) },
    });
    this.#say("blockid", `Test 1: an orchestrator is handed the old proofs for request #${requestId}.`);
    await replaying.handleRequest(requestId).then(
      () => this.#unexpected("the orchestrator accepted a replayed proof"),
      (error) => this.#reject(error),
    );

    // 2. A BlockID that does not check, and sends the old proofs to the contract anyway.
    this.#say("blockid", "Test 2: suppose BlockID is careless or dishonest and sends them to the contract without checking.");
    await world.rawChain.recordSync({ requestId, sourceClientId: stale[0].clientId, proofs: stale.map(proofToCalldata) }).then(
      () => this.#unexpected("the contract accepted a replayed proof"),
      (error) => this.#reject(error),
    );
  }

  /** Date-of-birth run: the honest BlockID stopped. Would a dishonest one get through? */
  async #dishonestOrchestrator() {
    const { world } = this;
    const requestId = this.requestIds.at(-1);
    const proofs = world.seen
      .filter((item) => item.kind === "proof")
      .map((item) => item.answer)
      .sort((a, b) => a.clientId - b.clientId);
    this.#say("blockid", "Now suppose BlockID is careless or dishonest and sends both proofs to the contract anyway.");
    await world.rawChain.recordSync({ requestId, sourceClientId: proofs[0].clientId, proofs: proofs.map(proofToCalldata) }).then(
      () => this.#unexpected("the contract accepted proofs with different commitments"),
      (error) => this.#reject(error),
    );
  }

  #unexpected(text) {
    this.#reject(new Error(text));
  }

  /** Record a rejection and write it to the log as the end of that attempt. */
  #reject(error) {
    const rejection = describeError(error, this.world.blockId.interface);
    this.rejections.push(rejection);
    const actor = rejection.layer.startsWith("The BlockID smart contract") ? "chain" : "blockid";
    this.#say(actor, `Rejected: ${rejection.label}. ${rejection.explanation}`, { error: true });
    this.#changed();
  }

  /** What BlockID saw is searched for the identity data and the salt. It must find none. */
  privacyCheck() {
    const haystack = JSON.stringify(this.world.seen, (_key, value) => (typeof value === "bigint" ? value.toString() : value)).toLowerCase();
    const fields = encodeIdentity(this.identity);
    const needles = {
      "full name": this.identity.fullName.toLowerCase(),
      "identity number": this.identity.identityNumber.toLowerCase(),
      "date of birth": this.identity.dateOfBirth,
      "name as a number": fields.fullName.toString(),
      "identity number as a number": fields.identityNumber.toString(),
      "nationality as a number": fields.nationality.toString(),
      "salt": this.salt?.toString() ?? null,
    };
    const checked = Object.keys(needles);
    const leaks = Object.entries(needles).filter(([, needle]) => needle && haystack.includes(needle)).map(([label]) => label);
    return { checked, leaks };
  }
}
