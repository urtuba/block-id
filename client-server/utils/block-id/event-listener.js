const ethers = require("ethers");
const { BlockIDAccountABI } = require("./abi");
require("dotenv").config();
async function getTransfer() {
  const blockIDAddress = "0x7A763395073FDE9CC7EcC6E6BDB98239fB39396b";
  const provider = new ethers.providers.WebSocketProvider(
    `wss://goerli-events.zksync.io/`
  );

  const contract = new ethers.Contract(
    blockIDAddress,
    BlockIDAccountABI.abi,
    provider
  );

  contract.on("IdentityRequested", (account, targetClientId) => {
    let transferEvent = { account, targetClientId };
    console.log(JSON.stringify(transferEvent, null, 4));
  });
}
getTransfer();
