const mongoose = require('mongoose')

const IdentityVerificationSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      required: true,
      ref: 'User',
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      require: true,
    },
    identityNumber: {
      type: String,
      required: true,
    },
    nationality: {
      type: String,
      required: true,
    },
    birthDate: {
      type: Date,
      required: true,
    },
    identityDocuments: {
      // This represents the path of the uploaded documents
      // Normally it should be a reference to a Document model
      type: [String],
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "identityVerifications"
  }
)

module.exports = mongoose.model("IdentityVerification", IdentityVerificationSchema)