const express = require('express')
const bodyParser = require('body-parser')

const connectDb = require('./utils/db')
const blockIdRouter = require( './routes/block-id/router' )
const apiRouter = require( './routes/api/router' )

connectDb()
const app = express()
const port = process.env.PORT || 3000

app.use(bodyParser.json())

app.get('/health', (req, res) => { res.send({ status: 'ok' }) })
app.use('/block-id', blockIdRouter)
app.use('/api', apiRouter)

app.listen(port, () => console.log(`Listening on port ${port}`))



