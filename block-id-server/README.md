# block-id-server (2023 prototype, kept as reference)

The BlockID orchestrator of the ETHGlobal Istanbul hackathon project (November 2023): an Express server that listened for `IdentityRequested` events of the zkSync contract and ran `orchestrateIdentitySync` (`utils.js`, `helpers.js`).

What it really did in 2023: the flow was in place, but the core steps were stubs.

- `getAuthorizedSources` returned two hard-coded localhost exchanges instead of reading the chain.
- `validateProofs` always answered "verified".
- `getClient` returned a fixed exchange.
- The consistency check compared `publicSignals[1]` (the client and account pair), not identity data.
- `helpers.js` had a syntax error (`const contractResult = {name: }`), so the server never started. The line is fixed so the file parses, but the server still does not work: the chain it listens to (zkSync Era Goerli) is gone, it needs the 2023 SDK and circuits (kept at the tag `original-2023`), and the steps above are still stubs.

**This folder is not maintained.** It is kept as a reference for how the idea started.

Replaced by the `Orchestrator` in [`block-id-sdk`](../block-id-sdk): it reads the grants and the request from the contract, verifies every proof off-chain, checks that all identity commitments are equal, and records the sync on-chain, where the contract verifies the proofs again.
