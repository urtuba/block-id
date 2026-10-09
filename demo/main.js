// The page: loads the proving files, starts the in-browser chain, and draws the world and
// the story (world.js, story.js) as panels and a step log. Nothing here is protocol logic.
import { identityCommitment } from "../block-id-sdk/src/index.js";
import { SCENARIOS, STEPS, Story } from "./story.js";
import { EXCHANGES, createWorld, exchangeName, short } from "./world.js";

const $ = (id) => document.getElementById(id);

/** Build an element: el("p", { class: "x" }, "text", child, ...). Text is never parsed as HTML. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value == null) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  return node;
}

/** Replace what is in `parent` with `children` (nested arrays, null and false are skipped). */
function fill(parent, ...children) {
  parent.replaceChildren(...children.flat(Infinity).filter((child) => child != null && child !== false));
}

const ART = "front-end/hinance/src/constants/";
const TAGS = { wallet: "Wallet", ex1: exchangeName(1), ex2: exchangeName(2), ex3: exchangeName(3), blockid: "BlockID", chain: "Contract" };
const PANEL_OF = { chain: "blockid" };

const ARTIFACTS = {
  wasm: new URL("../circuits/artifacts/identity-proof.wasm", import.meta.url),
  zkey: new URL("../circuits/artifacts/identity-proof.zkey", import.meta.url),
  vkey: new URL("../circuits/artifacts/vkey.json", import.meta.url),
};

const app = { artifacts: null, vkey: null, identity: null, story: null, world: null, scenario: null, generation: 0, busy: true };

// ---- loading -----------------------------------------------------------------------

function setStatus(text, fraction) {
  $("status-text").textContent = text;
  $("status-bar").hidden = fraction == null;
  if (fraction != null) $("status-fill").style.width = `${Math.round(fraction * 100)}%`;
}

/** Download a file as bytes and report progress as a fraction of its size (0 to 1). */
async function fetchBytes(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url.pathname} answered ${response.status}`);
  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(total ? Math.min(received / total, 1) : 0, received);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function loadProvingFiles() {
  const sizes = { wasm: 2.1, zkey: 0.46 };
  const done = { wasm: 0, zkey: 0 };
  const update = () => {
    const total = sizes.wasm + sizes.zkey;
    const fraction = (done.wasm * sizes.wasm + done.zkey * sizes.zkey) / total;
    setStatus(`Downloading the proving files (${total.toFixed(1)} MB): ${Math.round(fraction * 100)}%`, fraction);
  };
  setStatus("Downloading the proving files (2.6 MB)…", 0);
  const [wasm, zkey, vkey] = await Promise.all([
    fetchBytes(ARTIFACTS.wasm, (fraction) => ((done.wasm = fraction), update())),
    fetchBytes(ARTIFACTS.zkey, (fraction) => ((done.zkey = fraction), update())),
    fetch(ARTIFACTS.vkey).then((response) => response.json()),
  ]);
  return { artifacts: { wasm, zkey }, vkey };
}

// ---- drawing -------------------------------------------------------------------------

function facts(rows) {
  return el("dl", { class: "facts" }, rows.map(([term, value]) => [el("dt", {}, term), el("dd", {}, value)]));
}
const empty = (text) => el("span", { class: "empty" }, text);
const mono = (text, title) => el("code", { title }, text);

function renderIdentityLine() {
  $("identity-name").textContent = app.identity.fullName;
  $("identity-number").textContent = app.identity.identityNumber;
  $("identity-dob").textContent = app.identity.dateOfBirth;
}

function renderControls(view) {
  const next = $("btn-next");
  const waitingStep = STEPS.find((step) => step.id === view.waiting);
  const ended = view.status === "done" || view.status === "rejected";
  const stepNumber = view.waiting ? STEPS.findIndex((step) => step.id === view.waiting) + 1 : view.passed.length;

  if (app.busy) {
    next.textContent = "Setting up…";
    $("progress").textContent = "Starting a fresh chain.";
  } else if (waitingStep) {
    next.textContent = `Next step: ${waitingStep.label}`;
    $("progress").textContent = `Step ${stepNumber} of ${STEPS.length}`;
  } else if (ended) {
    next.textContent = view.status === "done" ? "The story is complete. Try “Break it” below." : "This run ended in a rejection, see above.";
    $("progress").textContent = view.status === "done" ? "Done" : "Rejected";
  } else {
    next.textContent = app.scenario ? "Running…" : "Working…";
    $("progress").textContent = app.scenario ? `Break it: ${SCENARIOS.find((s) => s.id === app.scenario).title}` : `Step ${stepNumber} of ${STEPS.length}`;
  }
  next.disabled = app.busy || !waitingStep;
  $("btn-all").disabled = app.busy || ended || app.story?.auto;
  $("btn-restart").disabled = app.busy;
  $("btn-identity").disabled = app.busy;
}

function commitmentOf(record) {
  return short(identityCommitment(record.identity, record.salt).toString(), 6, 4);
}

function recordFacts(record) {
  return [
    ["Full name", record.identity.fullName],
    ["Identity number", mono(record.identity.identityNumber)],
    ["Nationality", record.identity.nationality],
    ["Date of birth", record.identity.dateOfBirth],
    ["Identity commitment", mono(commitmentOf(record), "Poseidon(name, number, nationality, date of birth, salt)")],
  ];
}

function renderPanels(view) {
  // Wallet
  const walletBody = $("body-wallet");
  if (!view.wallet) {
    fill(walletBody, el("p", { class: "empty" }, "No wallet yet. The first step makes one."));
  } else {
    fill(walletBody,
      facts([
        ["Address", mono(short(view.wallet, 10, 6), view.wallet)],
        ["Salt", view.salt ? mono(view.salt, "Derived from the wallet's signature of a fixed message") : empty("not derived yet")],
        ["Granted sources", view.grants.length ? view.grants.map(exchangeName).join(", ") : empty("none")],
      ]),
      el("p", { class: "note" }, "The key was made in this tab and stays in memory. The chain is in this tab too."),
      view.waiting === "grant1" || view.waiting === "grant2"
        ? el("img", { class: "art", src: `${ART}connect-your-identity.svg`, width: 342, height: 44, alt: "Connect your identity" })
        : null,
    );
  }

  // Exchanges 1 and 2: sources
  for (const id of [1, 2]) {
    const body = $(`body-ex${id}`);
    const record = view.records[id];
    if (record) {
      fill(body,
        facts([...recordFacts(record), ["Granted as a source", view.grants.includes(id) ? el("span", { class: "tick" }, "yes") : view.wallet && view.passed.includes(`grant${id}`) ? el("span", { class: "cross" }, "no, revoked") : empty("not yet")]]),
        el("p", { class: "note" }, "This data stays here. Only a proof about it leaves."),
      );
    } else {
      fill(body, el("p", { class: "empty" }, "No KYC record for this user yet."));
    }
  }

  // Exchange 3: the target
  const ex3 = $("body-ex3");
  const record3 = view.records[3];
  const asking = view.passed.includes("request") || view.requestId != null;
  if (record3) {
    fill(ex3,
      el("div", { class: "success" }, el("img", { src: `${ART}success.svg`, width: 174, height: 184, alt: "" }), el("p", {}, "Verified with BlockID")),
      facts([...recordFacts(record3), ["Came from", record3.source.startsWith("blockid:") ? `${exchangeName(Number(record3.source.slice(8)))}, via BlockID` : record3.source]]),
    );
  } else if (asking) {
    fill(ex3,
      el("p", {}, "The user chose “Continue with BlockID”. Hinance waits for BlockID."),
      el("img", { class: "art", src: `${ART}continue-with-blockid.svg`, width: 232, height: 44, alt: "Continue with BlockID" }),
    );
  } else {
    fill(ex3,
      el("p", { class: "empty" }, "The user has no account here and never did KYC here."),
      view.wallet ? el("p", { class: "note" }, "At the sign-up step, the user can choose “Continue with BlockID” instead of uploading documents.") : null,
    );
  }

  // BlockID
  const blockId = $("body-blockid");
  const world = app.world;
  fill(blockId,
    facts([
      ["Contract", world ? mono(short(world.blockIdAddress, 10, 6), world.blockIdAddress) : empty("deploying")],
      ["Chain", "Tevm, an EVM running in this tab"],
      ["Requests", view.requestId != null ? `#${view.requestId}` : empty("none yet")],
      ["Sync recorded", view.sync ? el("span", {}, el("span", { class: "tick" }, "yes"), " in tx ", mono(short(view.sync.txHash, 8, 4), view.sync.txHash), `, ${view.sync.gasUsed.toLocaleString("en-US")} gas`) : empty("not yet")],
    ]),
    el("p", { class: "note" }, "BlockID holds no personal data. It handles proofs and one commitment."),
  );
}

function renderSeen(view) {
  const items = view.seen;
  const box = el("div", { class: "seen-box" },
    el("p", {}, el("strong", {}, "Received so far: "), items.length ? "" : "nothing yet."),
    items.length
      ? el(
          "ul",
          {},
          items.map((item) =>
            item.kind === "proof"
              ? el("li", {}, `A proof from ${exchangeName(item.from)}. Its four public numbers: commitment `, mono(short(item.answer.publicSignals[0], 6, 4), item.answer.publicSignals[0]), `, wallet, exchange ${item.answer.publicSignals[2]}, request ${item.answer.publicSignals[3]}. The rest of the proof is random-looking numbers that say nothing about the person.`)
              : el("li", {}, `A one-time share code from ${exchangeName(item.from)}. Only Hinance can redeem it, so it is useless to BlockID.`),
          ),
        )
      : null,
    el("p", {}, el("strong", {}, "Never received: "), "the full name, the identity number, the nationality, the date of birth, or the salt."),
    view.privacy
      ? view.privacy.leaks.length
        ? el("p", {}, el("span", { class: "cross" }, "Found in what BlockID received: "), view.privacy.leaks.join(", "))
        : el("p", {}, el("span", { class: "tick" }, "Checked just now: "), `none of these (${view.privacy.checked.join(", ")}) appears anywhere in what BlockID received.`)
      : null,
  );
  fill($("seen-body"), box);
}

function renderResult(view) {
  const box = $("result");
  const ended = view.status === "done" || view.status === "rejected";
  if (!ended) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.className = `result ${view.status}`;
  const scenario = SCENARIOS.find((s) => s.id === app.scenario);

  if (view.status === "done") {
    fill(box,
      el("h2", {}, "It worked: Hinance has the verified identity"),
      el("p", {}, `${exchangeName(view.sync.sourceClientId)} handed it over. The chain holds a record of the sync (${view.sync.gasUsed.toLocaleString("en-US")} gas for two proofs), and BlockID saw only proofs and a commitment. Now try to cheat.`),
    );
    return;
  }

  fill(box,
    el("h2", {}, scenario ? `Rejected: ${scenario.title}` : "Rejected"),
    scenario ? el("p", {}, scenario.summary) : null,
    view.rejections.map((rejection) =>
      el(
        "div",
        { class: "why" },
        el("p", { class: "layer" }, `Refused by: ${rejection.layer}`),
        el("code", { class: "label" }, rejection.label),
        el("p", {}, rejection.explanation),
      ),
    ),
    el(
      "ul",
      {},
      el("li", {}, view.sync ? `Syncs recorded on the chain: 1 (request ${view.sync.requestId}).` : "Syncs recorded on the chain: none."),
      el("li", {}, view.records[3] ? `${exchangeName(3)} holds the identity from the first, honest request.` : `${exchangeName(3)} holds no identity for this user.`),
    ),
  );
}

function renderScenarios(view) {
  const ready = !app.busy && (view.status === "done" || view.status === "rejected");
  for (const button of document.querySelectorAll(".scenario")) button.disabled = !ready;
}

function render() {
  const { story } = app;
  if (!story) return;
  const view = story.view;
  renderControls(view);
  renderPanels(view);
  renderSeen(view);
  renderResult(view);
  renderScenarios(view);
  $("app").dataset.state = app.busy ? "setup" : view.status;
}

function addLog(entry) {
  const item = el(
    "li",
    { "data-actor": entry.actor, class: entry.error ? "error" : entry.ok ? "ok" : "" },
    el("span", { class: "tag" }, TAGS[entry.actor] ?? entry.actor),
    el("span", { class: "text" }, entry.text),
    entry.tx ? el("span", { class: "tx" }, "tx ", mono(short(entry.tx, 10, 6), entry.tx)) : null,
  );
  const log = $("log");
  log.append(item);
  log.scrollTop = log.scrollHeight;

  const panel = PANEL_OF[entry.actor] ?? entry.actor;
  for (const node of document.querySelectorAll(".panel")) node.classList.toggle("active", node.dataset.actor === panel);
}

// ---- runs ----------------------------------------------------------------------------

/** Start a story on a fresh chain. `scenario` null is the guided story. */
async function startRun(scenario = null) {
  const generation = ++app.generation;
  app.busy = true;
  app.scenario = scenario;
  $("log").replaceChildren();
  for (const node of document.querySelectorAll(".panel")) node.classList.remove("active");
  if (app.story) render();
  const started = performance.now();

  const { startEvm } = await import("./evm.js");
  const evm = await startEvm();
  const world = await createWorld({ ...evm, artifacts: app.artifacts, vkey: app.vkey });
  if (generation !== app.generation) return; // the visitor started over while this was loading

  world.on((entry) => generation === app.generation && addLog(entry));
  const story = new Story({ world, identity: app.identity, scenario, auto: scenario !== null, onChange: () => generation === app.generation && render() });
  app.world = world;
  app.story = story;
  app.busy = false;
  app.setupMs = Math.round(performance.now() - started);
  render();
  story.run().then(() => {
    if (generation !== app.generation) return;
    render();
    if (scenario) $("result").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  });
}

function buildScenarioButtons() {
  $("scenarios").replaceChildren(
    ...SCENARIOS.map((scenario) =>
      el("button", { type: "button", class: "scenario", "data-scenario": scenario.id, disabled: true }, el("span", { class: "t" }, scenario.title), el("span", { class: "s" }, scenario.summary)),
    ),
  );
  $("scenarios").addEventListener("click", (event) => {
    const button = event.target.closest(".scenario");
    if (button && !button.disabled) startRun(button.dataset.scenario).catch(fatal);
  });
}

function fatal(error) {
  console.error(error);
  app.busy = true;
  $("app").hidden = true;
  $("status").hidden = false;
  setStatus(`The demo stopped: ${error?.message ?? error}. Reload the page to try again.`, null);
}

async function main() {
  const loadStarted = performance.now();
  const { newIdentity } = await import("./identities.js");
  const files = await loadProvingFiles();
  app.artifacts = files.artifacts;
  app.vkey = files.vkey;
  app.identity = newIdentity();
  renderIdentityLine();
  buildScenarioButtons();

  $("btn-next").addEventListener("click", () => app.story?.next());
  $("btn-all").addEventListener("click", () => app.story?.runAll());
  $("btn-restart").addEventListener("click", () => startRun().catch(fatal));
  $("btn-identity").addEventListener("click", () => {
    app.identity = newIdentity();
    renderIdentityLine();
    startRun().catch(fatal);
  });

  setStatus("Starting the chain and deploying the contracts…", null);
  await startRun();
  $("app").hidden = false;
  $("status").hidden = true;
  app.loadMs = Math.round(performance.now() - loadStarted);
  $("app").dataset.loadMs = String(app.loadMs);
}

main().catch(fatal);
