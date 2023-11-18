// simple express server

const express = require('express');
const bodyParser = require('body-parser');

const port = process.env.PORT || 4000;
const app = express();

app.use(bodyParser.json())
app.get('/health', (req, res) => { res.send({ status: 'ok' }) })

// INIT BLOCKHAIN LISTENER PROCESS THAT WILL BE ALIVE FOR THE LIFE OF THE SERVER

app.listen(port, () => console.log(`Listening on port ${port}`));