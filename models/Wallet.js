const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const walletSchema = new Schema(
	{
		name: {
			type: String,
		},
		totalBalance: {
			type: Number,
		},
		availableBalance: {
			type: Number,
		},
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
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
