const mongoose = require("mongoose");

const chartSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		history: {
			hourly: [
				{
					timestamp: { type: Date, default: Date.now },
					balance: { type: Number, required: true },
				},
			],
			daily: [
				{
					timestamp: { type: Date, default: Date.now },
					balance: { type: Number, required: true },
				},
			],
			weekly: [
				{
					timestamp: { type: Date, default: Date.now },
					balance: { type: Number, required: true },
				},
			],
			monthly: [
				{
					timestamp: { type: Date, default: Date.now },
					balance: { type: Number, required: true },
				},
			],
			yearly: [
				{
					timestamp: { type: Date, default: Date.now },
					balance: { type: Number, required: true },
				},
			],
		},
		lastUpdated: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
	}
);

// Indexes
chartSchema.index({ userId: 1 });
chartSchema.index({ lastUpdated: 1 });

// Method to get formatted chart data
chartSchema.methods.getChartData = function (timeframe = "daily") {
	return this.history[timeframe].map((entry) => ({
		date: entry.timestamp,
		balance: entry.balance,
	}));
};

const Chart = mongoose.model("Chart", chartSchema);
module.exports = Chart;
