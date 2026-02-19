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
      isMarginEnabled: { type: Boolean, default: false },
    },
    notification: {
      priceAlert: { type: Boolean, default: false },
      emailAlert: { type: Boolean, default: false },
      deviceLoginAlert: { type: Boolean, default: false },
      purchaseAlert: { type: Boolean, default: false },
    },

    beneficiary: {
      firstName: { type: String },
      lastName: { type: String },
      nationality: {
        name: { type: String },
        id: { type: Schema.Types.ObjectId, ref: "Nationality" },
      },
      dob: { type: Date },
      contact: {
        email: { type: String },
        phone: { type: String },
      },
      address: {
        street: { type: String },
        city: { type: String },
        state: {
          name: { type: String },
          id: { type: Schema.Types.ObjectId, ref: "State" },
        },
        country: {
          name: { type: String },
          phoneCode: { type: String },
          id: { type: Schema.Types.ObjectId, ref: "Country" },
        },
        zipCode: { type: String },
      },
    },

    limits: {
      deposit: {
        bank: {
          min: { type: Number, default: 100 },
          max: { type: Number, default: 1000 },
        },
        crypto: {
          min: { type: Number, default: 100 },
          max: { type: Number, default: 1000 },
        },
      },
      withdrawal: {
        bank: {
          min: { type: Number, default: 100 },
          max: { type: Number, default: 1000 },
        },
        crypto: {
          min: { type: Number, default: 100 },
          max: { type: Number, default: 1000 },
        },
      },
    },
    cryptoWallets: {
      btc: { type: String },
      eth: { type: String },
      usdtTrc: { type: String },
      usdtErc: { type: String },
      note: { type: String, default: "Default note" },
    },
    bankDetails: {
      accountName: { type: String },
      accountNumber: { type: String },
      routing: { type: String },
      reference: { type: String },
      address: { type: String },
      bankName: { type: String },
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
