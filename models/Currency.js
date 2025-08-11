const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const currencySchema = new Schema(
	{
		name: {
			type: String,
		},
		symbol: {
			type: String,
		},
		sign: {
			type: String,
		},
		rate: {
			type: Number,
		},
		fees: {
			type: Number,
		},
	},
	{ timestamps: true }
);

const Currency = mongoose.model("Currency", currencySchema);
module.exports = Currency;
