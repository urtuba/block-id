import mongoose from 'mongoose'
import nanoid from 'nanoid'

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

export default mongoose.model('BlockIdGrantCode', BlockIdGrantCodeSchema)