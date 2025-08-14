const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const walletSchema = new Schema(
	{
		name: {
			type: String,
		},
		totalBalance: {
			type: Number,
			default: 0,
		},
		availableBalance: {
			type: Number,
			default: 0,
		},
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		dailyProfit: {
			type: Number,
			default: 0,
		},
		dailyProfitPercent: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true }
);

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;
