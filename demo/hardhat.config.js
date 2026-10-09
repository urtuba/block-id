import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";

// No Solidity here. The tests run the demo's story on Hardhat's in-process network, with the
// contracts from contracts/contract-data.js, the same bytecode the page deploys.
export default {
  plugins: [hardhatEthers, hardhatMocha],
  paths: {
    tests: { mocha: "./test" },
  },
};
