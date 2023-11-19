// simple express server

const express = require('express');
const { orchestrateIdentitySync } = require( './utils' );

const port = process.env.PORT || 4000;
const app = express();

app.get('/health', (req, res) => { res.send('OK') })
app.get('/test', (req, res) => {
  const { wallet, target } = req.query
  if(!wallet || !target) {
    return res.status(400).send('Missing wallet or target')
  }
  orchestrateIdentitySync(wallet, target)
  return res.send('OK')
})

// INIT BLOCKHAIN LISTENER PROCESS THAT WILL BE ALIVE FOR THE LIFE OF THE SERVER

app.listen(port, () => console.log(`Listening on port ${port}`));