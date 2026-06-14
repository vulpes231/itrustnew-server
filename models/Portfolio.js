// models/PortfolioSnapshot.js
const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    currentNetWorth: {
      type: Number,
      required: true,
      min: 0,
    },
    wallet: {
      name: { type: String },
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet" },
      // index: true,
    },
    reason: {
      type: String,
      enum: [
        "account_creation",
        "deposit",
        "withdrawal",
        "trade_buy",
        "trade_sell",
        "profit_loss",
        "extra_bonus",
        "manual_adjustment",
      ],
      required: true,
    },
    metadata: {
      transactionId: { type: mongoose.Schema.Types.ObjectId },
      assetSymbol: { type: String },
      tradeAmount: { type: Number },
      pnlAmount: { type: Number },
    },
  },
  {
    timestamps: true,
  },
);

portfolioSchema.index({ userId: 1, timestamp: -1 });

const Portfolio = mongoose.model("PortFolio", portfolioSchema);
module.exports = Portfolio;
