# aa-contracts (2023 prototype, kept as history)

The smart contracts of the ETHGlobal Istanbul hackathon project (November 2023), written for zkSync Era account abstraction:

- `BlockID.sol`: a registry of exchanges (`addClient`, `getClient`) that emits `IdentityRequested`. `requestIdentity(account, ...)` took the account as an argument, so anyone could request an identity sync for any account.
- `BlockIDAccount.sol`: a zkSync account (smart wallet) that kept the list of exchanges its owner had authorized.
- `AAFactory.sol`, `TwoUserMultisig.sol`: the factory and multisig account from the zkSync account-abstraction tutorial.

The deploy scripts target zkSync Era Goerli (shut down) and Scroll Sepolia. The contracts need zkSync system contracts and the zkSync toolchain, so they do not run on a plain EVM, and nothing here has been run since 2023.

**This folder is not maintained.** It is untouched so the record stays as it was. The deploy scripts and `hardhat.config.ts` contain a hard-coded testnet private key and RPC API keys from 2023. Treat them as public and never reuse them.

Replaced by [`contracts/`](../contracts): a plain-EVM `BlockID` contract with on-chain Groth16 proof verification, where `msg.sender` is the wallet that asks for a sync.
