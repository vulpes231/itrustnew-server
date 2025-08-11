const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const assetSchema = new Schema(
	{
		symbol: {
			type: String,
			required: true,
			unique: true,
			index: true,
			uppercase: true,
		},
		name: {
			type: String,
			required: true,
		},
		type: {
			type: String,
			enum: ["stock", "etf", "crypto"],
			required: true,
		},
		exchange: {
			type: String,
			enum: ["NYSE", "NASDAQ", "AMEX", "OTC", "BINANCE", "COINBASE", "FOREX"],
		},
		priceData: {
			current: { type: Number, required: true },
			open: { type: Number },
			previousClose: { type: Number },
			dayLow: { type: Number },
			dayHigh: { type: Number },
			change: { type: Number }, // Absolute change
			changePercent: { type: Number }, // Percentage change
			volume: { type: Number },
			avgVolume: { type: Number },
		},
		historical: {
			yearLow: { type: Number },
			yearHigh: { type: Number },
			movingAvg50: { type: Number },
			movingAvg200: { type: Number },
		},
		fundamentals: {
			marketCap: { type: Number },
			eps: { type: Number }, // Earnings Per Share
			pe: { type: Number }, // Price-to-Earnings
			dividendYield: { type: Number },
		},
		imageUrl: { type: String },
		externalIds: {
			finnhub: { type: String },
			yahoo: { type: String },
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		isTradable: {
			type: Boolean,
			default: true,
		},
		lastUpdated: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes for performance
assetSchema.index({ symbol: 1, exchange: 1 }); // Composite index
assetSchema.index({ type: 1 });
assetSchema.index({ "priceData.changePercent": -1 }); // For trending queries

// Virtual for formatted display name
// assetSchema.virtual("displayName").get(function () {
// 	return `${this.name} (${this.symbol})`;
// });

const Asset = mongoose.model("Asset", assetSchema);
module.exports = Asset;
