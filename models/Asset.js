const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const assetSchema = new Schema(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    apiId: {
      type: String,
      lowercase: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["stock", "etf", "crypto"],
      required: true,
    },
    exchange: {
      type: String,
      enum: ["NYSE", "NASDAQ", "AMEX", "OTC", "BINANCE", "COINBASE", "FOREX"],
    },
    priceData: {
      current: { type: Number, required: true },
      open: { type: Number },
      previousClose: { type: Number },
      dayLow: { type: Number },
      dayHigh: { type: Number },
      change: { type: Number },
      changePercent: { type: Number },
      volume: { type: Number },
      avgVolume: { type: Number },
    },
    historical: {
      yearLow: { type: Number },
      yearHigh: { type: Number },
    },
    fundamentals: {
      marketCap: { type: Number },
      eps: { type: Number },
      pe: { type: Number },
      dividendYield: { type: Number },
    },
    imageUrl: { type: String },
    isActive: {
      type: Boolean,
      default: true,
    },
    isTradable: {
      type: Boolean,
      default: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
assetSchema.index({ symbol: 1, exchange: 1 });
assetSchema.index({ type: 1 });
assetSchema.index({ "priceData.changePercent": -1 });
assetSchema.index({ apiId: 1 }); // For quick lookups by CoinGecko ID

const Asset = mongoose.model("Asset", assetSchema);
module.exports = Asset;
