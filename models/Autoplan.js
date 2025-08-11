const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const autoPlanSchema = new Schema(
	{
		name: {
			type: String,
		},
		minInvest: {
			type: Number,
		},
		maxInvest: {
			type: Number,
		},
		winRate: {
			type: Number,
		},
		duration: {
			type: String,
		},
		milestone: {
			type: String,
		},
		aum: {
			type: String,
		},
		expectedReturn: {
			type: Number,
		},
		dailyReturn: {
			type: Number,
		},
		status: {
			type: String,
		},
		img: {
			type: String,
		},
		planType: {
			type: String,
		},
	},
	{ timestamps: true }
);

const Autoplan = mongoose.model("Autoplan", autoPlanSchema);
module.exports = Autoplan;
