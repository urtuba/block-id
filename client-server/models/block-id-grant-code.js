const mongoose = require('mongoose')
const {nanoid} = require('nanoid')

const BlockIdGrantCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      default: () => nanoid(10)
    },
    validUntil: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 1000 * 60 * process.env.BLOCK_ID_GRANT_CODE_VALID_MINUTES) 
    }
  },
  {
    timestamps: true,
    collection: 'blockIdGrantCodes'
  }
)

module.exports =  mongoose.model('BlockIdGrantCode', BlockIdGrantCodeSchema)