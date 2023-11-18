const mongoose = require('mongoose')

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/block-id'
const dbName = process.env.MONGO_DB_NAME || 'block-id'

const connectDb = () => {
  mongoose.connect(mongoUri + dbName, { useNewUrlParser: true })
  mongoose.connection.on('error', () => {
    throw new Error(`unable to connect to database: ${mongoUri}`)
  })
}

module.exports = connectDb