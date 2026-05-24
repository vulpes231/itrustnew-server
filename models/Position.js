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
    customDate: { type: Date },
    wallet: {
      id: { type: Schema.Types.ObjectId, ref: "Wallet" },
      name: { type: String },
    },
    amountInvested: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    averageEntryPrice: { type: Number, default: 0 },
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
          quantityClosed: Number,
          principalClosed: Number,
          profitLossClosed: Number,
          closedAt: Date,
          remainingQuantity: Number,
          remainingPrincipal: Number,
          remainingProfitLoss: Number,
          priceAtClose: Number,
        },
      ],
      default: [],
    },
    tradeIds: {
      type: [Schema.Types.ObjectId],
      ref: "Trade",
      default: [],
    },
    history: {
      type: [
        {
          action: { type: String, enum: ["create", "add", "remove", "close"] },
          tradeId: { type: Schema.Types.ObjectId, ref: "Trade" },
          quantity: Number,
          amount: Number,
          price: Number,
          timestamp: Date,
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

positionSchema.index({
  userId: 1,
  status: 1,
  "asset.assetId": 1,
  "wallet.id": 1,
});
positionSchema.index({ userId: 1, status: 1, createdAt: -1 });

positionSchema.virtual("currentAveragePrice").get(function () {
  if (this.quantity === 0) return 0;
  return this.amountInvested / this.quantity;
});

const Position = mongoose.model("Position", positionSchema);
module.exports = Position;
