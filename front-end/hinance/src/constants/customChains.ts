import { Chain } from "wagmi";

export const zkChain = {
  name: "Local zkSync Era",
  id: 260,
  rpcUrls: { default: "http://localhost:8011" }, // "https://rpc.zksync.io/",
  blockExplorers: {
    default: { name: "zkSync", url: "https://zkscan.io/" },
    zkSync: { name: "zkSync", url: "https://zkscan.io/" },
  },
  network: "zkSync Era",
  nativeCurrency: {
    name: "zkEther",
    symbol: "zETH",
    decimals: 18,
  },
  testnet: false,
} as const satisfies Chain;
