import { utils, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { parseEther } from "ethers/lib/utils";

export default async function (hre: HardhatRuntimeEnvironment) {
  // Private key of the account used to deploy
  const wallet = new Wallet(
    "ac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3"
  );

  const deployer = new Deployer(hre, wallet);
  const factoryArtifact = await deployer.loadArtifact("AAFactory");
  const aaArtifact = await deployer.loadArtifact("TwoUserMultisig");

  // console.log(await wallet.getAllBalances());
  if (!aaArtifact.bytecode) {
    throw new Error("Bytecode of the contract is undefined.");
  }

  // Getting the bytecodeHash of the account
  const bytecodeHash = utils.hashBytecode(aaArtifact.bytecode);

  // const estimatedDeployFee = await deployer.estimateDeployFee(factoryArtifact, [
  //   bytecodeHash,
  // ]);
  const utf8EncodeText = new TextEncoder();

  // console.log(parseEther(estimatedDeployFee.toString()).toString());
  const factory = await deployer.deploy(
    factoryArtifact,
    [bytecodeHash],
    { gasLimit: ethers.utils.hexlify(1000000) },
    [
      // Since the factory requires the code of the multisig to be available,
      // we should pass it here as well.
      // aaArtifact.bytecode,
    ]
  );

  console.log(`AA factory address: ${factory.address}`);
}

// function hexToBytes(hex: string) {
//   let bytes = [];
//   for (let c = 0; c < hex.length; c += 2) {
//     bytes.push(parseInt(hex.substring(c, 2), 16));
//   }
//   return bytes;
// }
