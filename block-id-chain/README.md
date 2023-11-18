# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js
```

# ZK Setup
```shell
npm install -g circom2
npm install -g snarkjs
npm run zk:trusted-setup
npm run zk:circuits:compile
```

# ZK Cleanup
```shell
npm run zk:circuits:clean
npm run zk:trusted-setup:clean
```