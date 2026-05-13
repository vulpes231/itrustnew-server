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
  let startDate = new Date();
  let intervalFormat = {};

  switch (timeframe) {
    case "1h":
      startDate.setHours(now.getHours() - 1);
      intervalFormat = {
        $dateToString: { format: "%Y-%m-%d %H:00:00", date: "$timestamp" },
      };
      break;
    case "1d":
      startDate.setDate(now.getDate() - 1);
      intervalFormat = {
        $dateToString: { format: "%Y-%m-%d %H:00:00", date: "$timestamp" },
      };
      break;
    case "1w":
      startDate.setDate(now.getDate() - 7);
      intervalFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
      };
      break;
    case "1m":
      startDate.setMonth(now.getMonth() - 1);
      intervalFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
      };
      break;
    case "1y":
      startDate.setFullYear(now.getFullYear() - 1);
      intervalFormat = {
        $dateToString: { format: "%Y-%m", date: "$timestamp" },
      };
      break;
    default:
      startDate.setDate(now.getDate() - 7);
      intervalFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
      };
  }

  return this.aggregate([
    {
      $match: {
        userId: userId,
        timestamp: { $gte: startDate, $lte: now },
      },
    },
    {
      $group: {
        _id: intervalFormat,
        value: { $last: "$portfolioValue" },
        timestamp: { $last: "$timestamp" },
      },
    },
    {
      $sort: { timestamp: 1 },
    },
    {
      $project: {
        x: "$_id",
        y: "$value",
        timestamp: 1,
        _id: 0,
      },
    },
  ]);
};

portfolioSchema.statics.getFullHistory = async function (userId, timeframe) {
  const user = await mongoose.model("User").findById(userId);
  const startDate = user.createdAt;
  const now = new Date();

  let groupFormat = {};

  switch (timeframe) {
    case "1h":
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d %H:00:00", date: "$timestamp" },
      };
      break;
    case "1d":
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
      };
      break;
    case "1w":
      groupFormat = {
        $dateToString: {
          format: "%Y-%m-%d",
          date: {
            $dateFromParts: {
              year: { $year: "$timestamp" },
              week: { $isoWeek: "$timestamp" },
              weekday: 1,
            },
          },
        },
      };
      break;
    case "1m":
      groupFormat = {
        $dateToString: { format: "%Y-%m-01", date: "$timestamp" },
      };
      break;
    case "1y":
      groupFormat = {
        $dateToString: { format: "%Y-01-01", date: "$timestamp" },
      };
      break;
    default:
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
      };
  }

  return this.aggregate([
    {
      $match: {
        userId: userId,
        timestamp: { $gte: startDate, $lte: now },
      },
    },
    {
      $group: {
        _id: groupFormat,
        value: { $last: "$portfolioValue" },
        timestamp: { $last: "$timestamp" },
      },
    },
    {
      $sort: { timestamp: 1 },
    },
    {
      $project: {
        x: "$_id",
        y: "$value",
        rawTimestamp: "$timestamp",
        _id: 0,
      },
    },
  ]);
};

const Portfolio = mongoose.model("PortFolio", portfolioSchema);
module.exports = Portfolio;
