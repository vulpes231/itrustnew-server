const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const transactionSchema = new Schema(
	{
		method: {
			type: String,
			required: true,
		},
		type: {
			type: String,
			required: true,
		},
		receivingAccount: {
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
