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
      name: String,
      symbol: String,
      img: String,
    },

    legacyId: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },

    planId: {
      type: Schema.Types.ObjectId,
      ref: "Autoplan",
      default: null,
    },

    customDate: Date,

    assetType: {
      type: String,
      enum: ["stock", "crypto", "etf"],
      required: true,
    },

    orderType: {
      type: String,
      enum: ["buy", "sell"],
      required: true,
    },

    wallet: {
      id: { type: Schema.Types.ObjectId, ref: "Wallet" },
      name: String,
      slug: String,
    },

    plan: {
      id: { type: Schema.Types.ObjectId, ref: "Autoplan" },
      name: String,
    },

    execution: {
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      amount: { type: Number, required: true },
      leverage: { type: Number, default: null },
      interval: { type: String, default: null },
      type: { type: String, default: null },
      positionAmount: { type: Number, default: null },
      marginDebt: { type: Number, default: 0 },
      positionCost: { type: Number, default: null },
    },

    targets: {
      takeProfit: { type: Number, default: null },
      stopLoss: { type: Number, default: null },
      entryPoint: { type: Number, default: null },
      exitPoint: { type: Number, default: null },
    },

    performance: {
      currentBaseValue: { type: Number, default: 0 },

      currentValue: { type: Number, default: 0 },

      totalReturn: { type: Number, default: 0 },
      totalReturnPercent: { type: Number, default: 0 },

      todayMarketReturn: { type: Number, default: 0 },
      todayExtra: { type: Number, default: 0 },

      todayReturn: { type: Number, default: 0 },
      todayReturnPercent: { type: Number, default: 0 },

      todayStartValue: { type: Number, default: 0 },
      todayStartDate: { type: Date, default: null },
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

tradeSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1,
  "asset.assetId": 1,
});

module.exports = mongoose.model("Trade", tradeSchema);
