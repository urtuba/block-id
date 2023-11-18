import mongoose from "mongoose"
import nanoid from "nanoid"

const IdentityVerificationSchema = new mongoose.Schema(
  {
    userId: {
      // Normally it references the _id field of the User model
      // But for the sake of POC, we will use a string instead of creating a User model
      type: String,
      required: true,
      unique: true,
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

export default mongoose.model("IdentityVerification", IdentityVerificationSchema)