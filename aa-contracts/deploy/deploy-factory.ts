import { utils, Wallet, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { parseEther } from "ethers/lib/utils";

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider("https://testnet.era.zksync.dev");
  const etherProvider = new Provider(
    "https://eth-goerli.g.alchemy.com/v2/UWdhqbzoAoi2B5kQvjMtIRu8mYy5R6Ou"
  );
  // Private key of the account used to deploy
  const wallet = new Wallet(
    "2ab6b8a9f6a6272b8692591f235aa1aa3ba58994feefd1a04c9f251530b4f3e8",
    provider,
    etherProvider
  );

  const deployer = new Deployer(hre, wallet);
  const factoryArtifact = await deployer.loadArtifact("AAFactory");
  const aaArtifact = await deployer.loadArtifact("BlockIDAccount");

  // console.log(await wallet.getAllBalances());
  if (!aaArtifact.bytecode) {
    throw new Error("Bytecode of the contract is undefined.");
  }

  // Getting the bytecodeHash of the account
  const bytecodeHash = utils.hashBytecode(aaArtifact.bytecode);

  // console.log(parseEther(estimatedDeployFee.toString()).toString());
  const factory = await deployer.deploy(factoryArtifact, [bytecodeHash], {
    gasLimit: 1000000,
    customData: { bytecodeHash: bytecodeHash },
  });

  console.log(`AA factory address: ${factory.address}`);
}

// function hexToBytes(hex: string) {
//   let bytes = [];
//   for (let c = 0; c < hex.length; c += 2) {
//     bytes.push(parseInt(hex.substring(c, 2), 16));
//   }
//   return bytes;
// }
