# client-server (2023 prototype, kept as reference)

The demo exchange backend of the ETHGlobal Istanbul hackathon project (November 2023): Express and MongoDB (mongoose), started three times as three exchanges (`npm run demo:exchange1`, `demo:exchange2`, `demo:exchange3`). It had user registration, a KYC endpoint, wallet connection, and the four BlockID endpoints: `/block-id/proof`, `/block-id/grant-code`, `/block-id/exchange` and `/block-id/callback`.

Copy `.env.demo-client-N.example` to `.env.demo-client-N` and fill in a MongoDB connection string to run one.

**This folder is not maintained, and it does not run on this branch.** It depends on a MongoDB, on the 2023 `block-id-sdk` API and on the 2023 circuits (`CompleteIDVerification`), which were replaced. They are kept at the tag `original-2023`. The share code was a bearer token, so whoever held it (BlockID included) could read the identity data.

Replaced by the `Exchange` class in [`block-id-sdk`](../block-id-sdk): it stores a KYC record, proves the identity commitment, and issues and redeems one-time share codes with an expiry, bound to the target exchange. It needs no Express and no database.
