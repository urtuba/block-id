import { utils, Wallet, Provider } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

const pk = "2ab6b8a9f6a6272b8692591f235aa1aa3ba58994feefd1a04c9f251530b4f3e8";

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider("https://testnet.era.zksync.dev");
  const etherProvider = new Provider(
    "https://eth-goerli.g.alchemy.com/v2/UWdhqbzoAoi2B5kQvjMtIRu8mYy5R6Ou"
  );

  // Private key of the account used to deploy
  const wallet = new Wallet(pk, provider, etherProvider);

  const deployer = new Deployer(hre, wallet);
  const blockIdArtifact = await deployer.loadArtifact("BlockID");

  // console.log(parseEther(estimatedDeployFee.toString()).toString());
  const blockId = await deployer.deploy(blockIdArtifact);

  console.log(`Block ID address: ${blockId.address}`);
}
