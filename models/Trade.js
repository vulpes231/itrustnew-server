const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const tradeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    asset: {
      assetId: { type: Schema.Types.ObjectId, ref: "Asset" },
      name: { type: String },
      symbol: { type: String },
      img: { type: String },
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "Autoplan",
      default: null,
    },
    assetType: {
      type: String,
      enum: ["stocks", "crypto", "etf"],
      required: true,
    },
    orderType: {
      type: String,
      enum: ["buy", "sell"],
      required: true,
    },
    wallet: {
      id: { type: Schema.Types.ObjectId, ref: "Wallet" },
      name: { type: String },
    },
    execution: {
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      amount: { type: Number, required: true },
      leverage: { type: Number, default: null },
      interval: { type: String, default: null },
      type: { type: String, default: null },
      positionAmount: { type: Number, default: null },
    },
    targets: {
      takeProfit: { type: Number, default: null },
      stopLoss: { type: Number, default: null },
      entryPoint: { type: Number, default: null },
      exitPoint: { type: Number, default: null },
    },
    performance: {
      totalReturn: { type: Number, default: 0 },
      totalReturnPercent: { type: Number, default: 0 },
      todayReturn: { type: Number, default: 0 },
      todayReturnPercent: { type: Number, default: 0 },
      currentValue: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    extra: {
      type: Number,
      default: 0,
    },
    fullname: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tradeSchema.index({ userId: 1, status: 1, createdAt: -1, assetId: 1 });

const Trade = mongoose.model("Trade", tradeSchema);
module.exports = Trade;
