# BlockID

## Hardhat
```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js
```

## ZK Setup
```shell
npm install -g circom2
npm install -g snarkjs
npm run zk:trusted-setup
npm run zk:circuits:compile
npm run zk:circuits:keys
```

## ZK Cleanup
```shell
npm run zk:circuits:clean
npm run zk:trusted-setup:clean
```

## ZK SDK
```shell
npm run zk:sdk:example
```