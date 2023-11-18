const express = require('express')
const blockIdGrantCode = require( '../../models/block-id-grant-code' )

const blockIdRouter = express.Router()

router.post('/grant-code', blockIdGrantCode, require('./grant-code'))
router.get('/proof', blockIdGrantCode, require('./proof'))
router.get('/exchange', require('./exchange'))

module.exports = blockIdRouter