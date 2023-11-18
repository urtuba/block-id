const express = require('express')

const apiRouter = express.Router()

apiRouter.post('/register', require('./register'))
apiRouter.put('/user/wallet-address', require('./connect-wallet'))

module.exports = apiRouter