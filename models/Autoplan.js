const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const autoPlanSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
			index: true,
			trim: true,
		},
		planType: {
			type: String,
			required: true,
			index: true,
			enum: ["low", "moderate", "high"],
		},
		status: {
			type: String,
			index: true,
			enum: ["active", "inactive"],
			default: "active",
		},
		investmentRange: {
			min: {
				type: Number,
				required: true,
				min: 0,
			},
			max: {
				type: Number,
				required: true,
				validate: {
					validator: function (v) {
						return v > this.investmentRange.min;
					},
					message: "Max investment must be greater than min investment",
				},
			},
		},
		performance: {
			winRate: {
				type: Number,
			},
			expectedReturnPercent: {
				type: Number,
			},
			dailyReturnPercent: {
				type: Number,
			},
			aum: {
				type: String,
			},
		},
		expiresIn: {
			milestone: {
				type: Number,
				required: true,
			},
			duration: {
				type: String,
				enum: ["day", "week", "month", "year"],
			},
		},
		img: {
			url: String,
			altText: String,
		},

		isFeatured: {
			type: Boolean,
			default: false,
			index: true,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes
autoPlanSchema.index({ name: 1, planType: 1 });
autoPlanSchema.index({ "investmentRange.min": 1, "investmentRange.max": 1 });
autoPlanSchema.index({ "performance.winRate": -1 });

// Virtuals
autoPlanSchema.virtual("formattedDuration").get(function () {
	return `${this.expiresIn.milestone} ${this.expiresIn.duration}`;
});

const Autoplan = mongoose.model("Autoplan", autoPlanSchema);
module.exports = Autoplan;
