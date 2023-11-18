const mongoose = require('mongoose')

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/block-id'

const connectDb = () => {
  mongoose.connect(mongoUri, { useNewUrlParser: true })
  mongoose.connection.on('error', () => {
    throw new Error(`unable to connect to database: ${mongoUri}`)
  })
}

module.exports = connectDb