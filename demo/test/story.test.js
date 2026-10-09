// The demo's story, run in Node on a Hardhat chain with real proofs. These are the same
// functions the page calls (world.js and story.js); only the chain and the way test ETH is
// given differ. What this does not cover is demo/main.js, the DOM, and the in-browser EVM
// (Tevm): see "What CI tests for the demo" in the README.
import { expect } from "chai";
import { Story, STEPS, SCENARIOS } from "../story.js";
import { encodeIdentity } from "../../block-id-sdk/src/index.js";
import { IDENTITY, freshWorld } from "./helpers.js";

const wallet = (story) => story.user.address;
const labels = (story) => story.rejections.map((r) => r.label);

/** Run a scenario on a fresh world, the way the page does after "Break it". */
async function runScenario(scenario) {
  const world = await freshWorld();
  const story = new Story({ world, identity: IDENTITY, scenario, auto: true });
  await story.run();
  return { world, story };
}

const nothingRecorded = async (world) => {
  expect(await world.blockId.queryFilter(world.blockId.filters.IdentitySynced())).to.have.length(0);
  const [, , fulfilled] = await world.blockId.getRequest(1);
  expect(fulfilled).to.equal(false);
};

describe("the happy path", () => {
  it("syncs the identity from exchanges 1 and 2 to exchange 3, with a log that follows the sequence diagram", async () => {
    const world = await freshWorld();
    const log = [];
    world.on((entry) => log.push(entry));
    const story = new Story({ world, identity: IDENTITY, auto: true });
    await story.run();

    expect(story.rejections).to.deep.equal([]);
    expect(story.view.status).to.equal("done");
    const record = world.exchanges[3].getRecord(wallet(story));
    expect(record.identity).to.deep.equal(IDENTITY);
    expect(record.source).to.match(/^blockid:[12]$/);
    expect(story.view.grants).to.deep.equal([1, 2]);
    expect(story.view.sync.gasUsed).to.be.greaterThan(100_000).and.lessThan(700_000);
    expect(story.view.sync.sourceClientId).to.be.oneOf([1, 2]);

    // The sync is on the chain, with the commitment and no data.
    const events = await world.blockId.queryFilter(world.blockId.filters.IdentitySynced());
    expect(events).to.have.length(1);
    expect(events[0].args.identityCommitment.toString()).to.equal(story.view.sync.commitment);

    // The log tells the story in order, and the transaction hashes are real.
    const text = log.map((entry) => entry.text);
    const at = (pattern) => text.findIndex((line) => pattern.test(line));
    const order = [/demo wallet is created/, /Violex checks/, /grant\(1\)/, /Mintex checks/, /grant\(2\)/, /requestIdentity\(3\)/, /asks Violex for a proof/, /verified 2 proofs off-chain/, /one-time share code/, /recordSync/, /verified 2 Groth16 proofs on-chain/, /redeems the share code/, /Poseidon\(data, salt\)/];
    const positions = order.map(at);
    expect(positions, text.join("\n")).to.not.include(-1);
    expect(positions).to.deep.equal([...positions].sort((a, b) => a - b));
    expect(log.filter((entry) => entry.tx).every((entry) => /^0x[0-9a-f]{64}$/.test(entry.tx))).to.equal(true);
    expect(log.filter((entry) => entry.ms !== undefined)).to.have.length(2);
  });

  it("BlockID saw only proofs and share codes: no field of the identity and not the salt", async () => {
    const world = await freshWorld();
    const story = new Story({ world, identity: IDENTITY, auto: true });
    await story.run();

    expect(world.seen.map((item) => item.kind).sort()).to.deep.equal(["proof", "proof", "share code"]);
    expect(story.view.privacy.leaks).to.deep.equal([]);
    expect(story.view.privacy.checked).to.include.members(["full name", "identity number", "date of birth", "salt"]);

    // The check is not empty talk: it does find data when data is there.
    world.seen.push({ kind: "oops", leaked: IDENTITY.fullName.toUpperCase(), number: encodeIdentity(IDENTITY).identityNumber });
    expect(story.privacyCheck().leaks).to.have.members(["full name", "identity number as a number"]);
  });

  it("stops at each of the ten steps until told to go on, and 'run all' finishes the rest", async () => {
    const world = await freshWorld();
    const story = new Story({ world, identity: IDENTITY });
    const waits = [];
    const done = story.run();
    const waitingFor = async () => {
      for (let i = 0; i < 400 && !story.view.waiting; i++) await new Promise((r) => setTimeout(r, 25));
      return story.view.waiting;
    };

    for (let n = 0; n < 8; n++) {
      waits.push(await waitingFor());
      story.next();
      // Let the step take effect, then it is waiting again or running.
      await new Promise((r) => setTimeout(r, 10));
    }
    waits.push(await waitingFor());
    expect(waits).to.deep.equal(STEPS.slice(0, 9).map((step) => step.id));
    expect(world.exchanges[3].hasRecord(wallet(story))).to.equal(false);
    expect(await world.blockId.queryFilter(world.blockId.filters.IdentitySynced())).to.have.length(0);

    story.runAll();
    await done;
    expect(story.view.status).to.equal("done");
    expect(story.view.passed).to.deep.equal(STEPS.map((step) => step.id));
    expect(world.exchanges[3].getRecord(wallet(story)).identity).to.deep.equal(IDENTITY);
  });
});

describe("break it", () => {
  it("lists the three scenarios", () => {
    expect(SCENARIOS.map((s) => s.id)).to.deep.equal(["dob", "replay", "revoke"]);
  });

  it("(a) Exchange 2 has another date of birth: BlockID stops, and the contract would too", async () => {
    const { world, story } = await runScenario("dob");
    expect(story.view.status).to.equal("rejected");
    expect(labels(story)).to.deep.equal(["IDENTITY_MISMATCH", "CommitmentMismatch(1)"]);
    expect(story.rejections.map((r) => r.layer)).to.deep.equal(["BlockID's code (the protocol module)", "The BlockID smart contract"]);
    expect(story.view.records[1].identity.dateOfBirth).to.equal("1990-12-10");
    expect(story.view.records[2].identity.dateOfBirth).to.equal("1990-12-11");
    expect(world.exchanges[3].hasRecord(wallet(story))).to.equal(false);
    expect(world.seen.filter((item) => item.kind === "share code")).to.have.length(0);
    await nothingRecorded(world);
  });

  it("(b) replay: a valid proof from request 1 is refused for request 2 by BlockID and by the contract", async () => {
    const { world, story } = await runScenario("replay");
    expect(story.view.status).to.equal("rejected");
    // Request 1 was a good sync.
    expect(world.exchanges[3].hasRecord(wallet(story))).to.equal(true);
    expect(labels(story)).to.deep.equal(["PROOF_BINDING", "WrongNonce(0)"]);
    expect(story.rejections[0].message).to.match(/another request/);
    const [, , fulfilled2] = await world.blockId.getRequest(2);
    expect(fulfilled2).to.equal(false);
    expect(await world.blockId.queryFilter(world.blockId.filters.IdentitySynced())).to.have.length(1);
  });

  it("(c) revoke: the user revokes Exchange 2 before the sync, and the contract refuses with NotGranted(2)", async () => {
    const { world, story } = await runScenario("revoke");
    expect(story.view.status).to.equal("rejected");
    expect(labels(story)).to.deep.equal(["NotGranted(2)"]);
    expect(story.view.grants).to.deep.equal([1]);
    expect(await world.blockId.getGrants(wallet(story))).to.deep.equal([1n]);
    expect(world.exchanges[3].hasRecord(wallet(story))).to.equal(false);
    // The share code BlockID asked for exists but nobody redeemed it.
    expect(world.seen.filter((item) => item.kind === "share code")).to.have.length(1);
    await nothingRecorded(world);
  });
});
