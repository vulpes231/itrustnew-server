const { Schema, default: mongoose } = require("mongoose");

const verificationSchema = new Schema({
  fullname: {
    type: String,
    required: true,
  },
  idType: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    default: "pending",
  },
  frontId: {
    type: String,
    required: true,
  },
  backId: {
    type: String,
  },
  frontIdName: {
    type: String,
    required: true,
  },
  backIdName: {
    type: String,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

const Verification = mongoose.model("Verification", verificationSchema);

module.exports = Verification;
