// simple express server

const express = require('express');

const port = process.env.PORT || 4000;
const app = express();

app.get('/health', (req, res) => { res.send('OK') })

// INIT BLOCKHAIN LISTENER PROCESS THAT WILL BE ALIVE FOR THE LIFE OF THE SERVER

app.listen(port, () => console.log(`Listening on port ${port}`));