// simple express server
const express = require('express');
const { getContract, orchestrateIdentitySync } = require( './utils' );


const port = process.env.PORT || 4000;
const app = express();
const contract = getContract()

app.get('/health', (req, res) => { res.send('OK') })

app.get('/test', (req, res) => {
  const { wallet, target } = req.query
  if(!wallet || !target) {
    return res.status(400).send('Missing wallet or target')
  }
  orchestrateIdentitySync(wallet, target)
  return res.send('OK')
})

contract.on("IdentityRequested", (account, targetClientId) => {
  orchestrateIdentitySync(account, targetClientId)
});

// INIT BLOCKHAIN LISTENER PROCESS THAT WILL BE ALIVE FOR THE LIFE OF THE SERVER

app.listen(port, () => console.log(`Listening on port ${port}`));