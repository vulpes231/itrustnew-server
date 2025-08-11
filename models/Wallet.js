const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const walletSchema = new Schema(
	{
		name: {
			type: String,
		},
		balance: {
			type: Number,
		},
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		created: {
			type: String,
		},
		updated: {
			type: String,
		},
		dailyProfit: {
			type: Number,
		},
		dailyProfitPercent: {
			type: String,
		},
	},
	{ timestamps: true }
);

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;
