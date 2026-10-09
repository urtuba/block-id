import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";

// No Solidity here. The tests use Hardhat's in-process network and deploy the contracts
// from block-id-contracts/contract-data.js, the way the browser demo will.
export default {
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha],
  paths: {
    tests: { mocha: "./test" },
  },
};
