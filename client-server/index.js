const express = require('express')
const bodyParser = require('body-parser')

const connectDb = require('./utils/db')
const authorizeBlockId = require('./utils/authorize-block-id')
const blockIdGrantCode = require('./routes/block-id-grant-code')
const blockIdProof = require('./routes/block-id-proof')
const blockIdExchange = require('./routes/block-id-exchange')

connectDb()
const app = express()
const port = process.env.PORT || 3000

app.use(bodyParser.json())

app.get('/api/health', (req, res) => { res.send('OK')})
app.post('/api/block-id/grant-code', authorizeBlockId, blockIdGrantCode)
app.get('/api/block-id/proof', authorizeBlockId, blockIdProof)
app.get('/api/block-id/exchange', blockIdExchange)

app.listen(port, () => console.log(`Listening on port ${port}`))



