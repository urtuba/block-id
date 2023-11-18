import { HardhatUserConfig } from "hardhat/config";

import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-node";

const config: HardhatUserConfig = {
  zksolc: {
    version: "latest",
    settings: {
      isSystem: true,
    },
  },
  defaultNetwork: "zkSyncTestnet",
  networks: {
    hardhat: {
      zksync: true,
    },
    zkSyncTestnet: {
      url: "http://localhost:8011", // "https://zksync2-testnet.zksync.dev",
      ethNetwork: "goerli",
      chainId: 260,
      zksync: true,
      // Verification endpoint for Goerli
    },
  },
  solidity: {
    version: "0.8.19",
  },
};

export default config;
