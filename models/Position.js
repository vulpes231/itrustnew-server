const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const positionSchema = new Schema(
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
      type: {
        type: String,
        enum: ["stock", "crypto", "etf"],
        required: true,
      },
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "Autoplan",
      default: null,
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
    amountInvested: { type: Number, default: 0 },
    marketType: { type: String },
    customDate: { type: Date },
    performance: {
      totalReturn: { type: Number, default: 0 },
      totalReturnPercent: { type: Number, default: 0 },
      todayReturn: { type: Number, default: 0 },
      todayReturnPercent: { type: Number, default: 0 },
      currentValue: { type: Number, default: 0 },
      extra: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },

    fullname: {
      type: String,
      required: true,
    },
    partialCloses: {
      type: [
        {
          percentClosed: Number,
          principalClosed: Number,
          profitLossClosed: Number,
          closedAt: Date,
          remainingPrincipal: Number,
          remainingProfitLoss: Number,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

positionSchema.index({ userId: 1, status: 1, createdAt: -1, assetId: 1 });

const Position = mongoose.model("Position", positionSchema);
module.exports = Position;
