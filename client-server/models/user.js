const mongoose = require('mongoose')

const BlockIdGrantCodeSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      unique: true
    },
  },
  {
    timestamps: true,
    collection: 'users'
  }
)

module.exports =  mongoose.model('User', BlockIdGrantCodeSchema)