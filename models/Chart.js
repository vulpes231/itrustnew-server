// models/Chart.js
const mongoose = require("mongoose");

const chartEntrySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    balance: {
      type: Number,
      required: true,
    },
    eventType: {
      type: String,
      enum: ["deposit", "withdrawal", "trade", "snapshot", "signup"],
      required: true,
    },
    amount: Number, // For deposits/withdrawals
    pnl: Number, // Profit/loss from trade
    note: String, // Optional description
  },
  { _id: false }
);

const chartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    timeline: [chartEntrySchema],
    currentBalance: {
      type: Number,
      default: 0,
    },
    totalDeposits: {
      type: Number,
      default: 0,
    },
    totalWithdrawals: {
      type: Number,
      default: 0,
    },
    totalPnl: {
      type: Number,
      default: 0,
    },
    firstActivity: Date,
    lastActivity: Date,
  },
  {
    timestamps: true,
    capped: { size: 5 * 1024 * 1024, max: 10000 },
  }
);

chartSchema.index({ userId: 1, "timeline.timestamp": 1 });
chartSchema.index({ lastActivity: 1 });

chartSchema.methods.getChartData = function (timeframe = "daily", limit = 365) {
  if (this.timeline.length === 0) return [];

  const now = new Date();
  let timeLimit;

  switch (timeframe) {
    case "hourly":
      timeLimit = 24 * 60 * 60 * 1000;
      break;
    case "daily":
      timeLimit = limit * 24 * 60 * 60 * 1000;
      break;
    case "weekly":
      timeLimit = limit * 7 * 24 * 60 * 60 * 1000;
      break;
    default:
      timeLimit = 30 * 24 * 60 * 60 * 1000;
  }

  const cutoff = new Date(now.getTime() - timeLimit);

  return this.timeline
    .filter((entry) => entry.timestamp >= cutoff)
    .map((entry) => ({
      date: entry.timestamp,
      balance: entry.balance,
      eventType: entry.eventType,
      amount: entry.amount,
      pnl: entry.pnl,
    }));
};

const Chart = mongoose.model("Chart", chartSchema);
module.exports = Chart;
