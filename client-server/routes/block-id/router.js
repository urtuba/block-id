const express = require('express')
const authorizeBlockId = require( '../../utils/authorize-block-id' )

const blockIdRouter = express.Router()

blockIdRouter.post('/grant-code', authorizeBlockId, require('./grant-code'))
blockIdRouter.get('/proof', authorizeBlockId, require('./proof'))
blockIdRouter.get('/exchange', require('./exchange'))

module.exports = blockIdRouter