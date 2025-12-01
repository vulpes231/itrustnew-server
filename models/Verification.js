const { Schema, default: mongoose } = require("mongoose");

const verificationSchema = new Schema({
  fullname: {
    type: String,
    required: true,
  },
  dob: {
    type: String,
    required: true,
  },
  idType: {
    type: String,
    required: true,
  },
  idNumber: {
    type: String,
    required: true,
  },
  frontId: {
    type: String,
    required: true,
  },
  backId: {
    type: String,
    required: true,
  },
  frontIdName: {
    type: String,
    required: true,
  },
  backIdName: {
    type: String,
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

const Verification = mongoose.model("Verification", verificationSchema);

module.exports = Verification;
