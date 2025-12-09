const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const walletSettingSchema = new Schema(
  {
    name: {
      type: String,
      default: "global",
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
    depositLimits: {
      bank: {
        min: { type: Number },
        max: { type: Number },
      },
      crypto: {
        min: { type: Number },
        max: { type: Number },
      },
    },
    withdrawalLimits: {
      bank: {
        min: { type: Number },
        max: { type: Number },
      },
      crypto: {
        min: { type: Number },
        max: { type: Number },
      },
    },
  },
  { timestamps: true }
);

const WalletSetting = mongoose.model("WalletSetting", walletSettingSchema);
module.exports = WalletSetting;
