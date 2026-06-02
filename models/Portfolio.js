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
    portfolioValue: {
      type: Number,
      required: true,
      min: 0,
    },
    cashBalance: {
      type: Number,
      required: true,
    },
    assetValue: {
      type: Number,
      required: true,
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

portfolioSchema.statics.getTimeframeData = async function (userId, timeframe) {
  const now = new Date();
  let startDate;

  switch (timeframe) {
    case "1h":
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;

    case "1d":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;

    case "1w":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;

    case "1m":
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
      break;

    case "1y":
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;

    case "all":
      startDate = new Date(0);
      break;

    default:
      throw new Error("Invalid timeframe");
  }

  const snapshots = await this.find({
    userId: new mongoose.Types.ObjectId(userId),
    timestamp: {
      $gte: startDate,
      $lte: now,
    },
  })
    .sort({ timestamp: 1 })
    .lean();

  return snapshots.map((snapshot) => ({
    x: snapshot.timestamp,
    y: snapshot.portfolioValue,
    reason: snapshot.reason,
  }));
};

portfolioSchema.statics.getFullHistory = async function (userId, timeframe) {
  const now = new Date();
  let startDate;

  switch (timeframe) {
    case "1h":
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case "1d":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "1w":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1m":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = null;
  }

  const query = { userId };
  if (startDate) {
    query.timestamp = { $gte: startDate };
  }

  const snapshots = await this.find(query).sort({ timestamp: 1 });

  return snapshots.map((s) => ({
    x: s.timestamp,
    y: s.portfolioValue,
    reason: s.reason,
  }));
};
const Portfolio = mongoose.model("PortFolio", portfolioSchema);
module.exports = Portfolio;
