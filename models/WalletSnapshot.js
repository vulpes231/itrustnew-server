const mongoose = require("mongoose");

const walletSnapshotSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },

    walletName: {
      type: String,
    },

    cashValue: {
      type: Number,
      required: true,
      default: 0,
    },

    positionValue: {
      type: Number,
      required: true,
      default: 0,
    },

    totalValue: {
      type: Number,
      required: true,
      default: 0,
    },

    totalInvested: {
      type: Number,
      default: 0,
    },

    unrealizedPnL: {
      type: Number,
      default: 0,
    },

    realizedPnL: {
      type: Number,
      default: 0,
    },

    source: {
      type: String,
      enum: [
        "account_creation",
        "deposit",
        "withdraw",
        "contribution",
        "cashout",
        "trade_buy",
        "trade_sell",
        "profit_loss",
        "extra_bonus",
        "transfer_out",
        "transfer_in",
        "cron_update",
        "manual_adjustment",
      ],
      required: true,
    },

    metadata: {
      transactionId: mongoose.Schema.Types.ObjectId,
      tradeId: mongoose.Schema.Types.ObjectId,
      positionId: mongoose.Schema.Types.ObjectId,
      assetSymbol: String,
    },

    snapshotAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

walletSnapshotSchema.index({
  userId: 1,
  walletId: 1,
  snapshotAt: 1,
});

walletSnapshotSchema.index({
  walletId: 1,
  snapshotAt: 1,
});

walletSnapshotSchema.index({
  userId: 1,
  snapshotAt: 1,
});

module.exports = mongoose.model("WalletSnapshot", walletSnapshotSchema);
