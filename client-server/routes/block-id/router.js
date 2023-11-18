const express = require('express')
const authorizeBlockId = require( '../../utils/authorize-block-id' )

const blockIdRouter = express.Router()

blockIdRouter.get('/proof', authorizeBlockId, require('./proof'))
blockIdRouter.get('/exchange', require('./exchange'))
blockIdRouter.post('/callback', require('./callback'))
blockIdRouter.post('/grant-code', authorizeBlockId, require('./grant-code'))

module.exports = blockIdRouter