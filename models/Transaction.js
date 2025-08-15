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
			enum: ["deposit", "withdraw", "transfer"],
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
	},
	{
		timestamps: true,
	}
);

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
