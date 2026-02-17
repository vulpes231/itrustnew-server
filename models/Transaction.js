const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const transactionSchema = new Schema(
  {
    method: {
      mode: { type: String },
      network: { type: String },
    },
    type: {
      type: String,
      required: true,
      enum: ["deposit", "withdraw", "transfer", "savings"],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    account: {
      type: String,
      required: true,
    },
    memo: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "cancelled", "completed", "failed"],
    },
    email: {
      type: String,
      required: true,
    },
    fullname: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: true,
    virtuals: true,
  }
);

transactionSchema.index({ userId: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
