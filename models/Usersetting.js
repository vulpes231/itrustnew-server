const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSettingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    locks: {
      cash: {
        isLocked: { type: Boolean, default: false },
        message: {
          type: String,
          default: "Unauthorized, Contact support for more details",
        },
      },
      bankDeposit: {
        isLocked: { type: Boolean, default: false },
        message: {
          type: String,
          default: "Unauthorized, Contact support for more details",
        },
      },
    },

    trading: {
      mode: {
        type: String,
        enum: ["regular", "drip", "options", "multi"],
        default: "regular",
      },
      isDripEnabled: { type: Boolean, default: false },
      isOptionsEnabled: { type: Boolean, default: false },
    },

    beneficiary: {
      firstName: { type: String },
      lastName: { type: String },
      nationality: { type: String },
      dob: { type: Date },
      contact: {
        email: { type: String },
        phone: { type: String },
      },
      address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        zipCode: { type: String },
      },
    },

    limits: {
      deposit: {
        bank: { min: Number, max: Number },
        crypto: { min: Number, max: Number },
      },
      withdrawal: {
        bank: { min: Number, max: Number },
        crypto: { min: Number, max: Number },
      },
    },

    wallet: {
      isConnected: { type: Boolean, default: false },
      connectedAt: { type: Date },
      walletInfo: { type: String },
      walletName: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserSetting", userSettingSchema);
