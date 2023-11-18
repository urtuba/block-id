const express = require('express')

const apiRouter = express.Router()

apiRouter.get('/user/:userId', require('./user'))
apiRouter.post('/user/:userId/kyc', require('./kyc'))
apiRouter.post('/user', require('./register'))
apiRouter.put('/user/wallet-address', require('./connect-wallet'))

module.exports = apiRouter