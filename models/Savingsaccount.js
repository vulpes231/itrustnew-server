const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Custom Error class
class CustomError extends Error {
	constructor(message, statusCode) {
		super(message);
		this.statusCode = statusCode;
		this.name = "CustomError";
	}
}

const savingsAccountSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		title: {
			type: String,
			required: true,
		},
		note: {
			type: String,
			required: true,
		},
		interestRate: {
			type: Number,
			required: true,
			min: 0,
			max: 100,
		},
		contributionLimits: {
			min: {
				type: Number,
				required: true,
				min: 0,
			},
			max: {
				type: Number,
				required: true,
				min: 0,
				validate: {
					validator: function (value) {
						return value >= this.contributionLimits.min;
					},
					message:
						"Max contribution limit must be greater than or equal to min contribution limit",
				},
			},
		},
		withdrawalLimits: {
			min: {
				type: Number,
				required: true,
				min: 0,
			},
			max: {
				type: Number,
				required: true,
				min: 0,
				validate: {
					validator: function (value) {
						return value >= this.withdrawalLimits.min;
					},
					message:
						"Max withdrawal limit must be greater than or equal to min withdrawal limit",
				},
			},
		},
		eligibleCountries: [
			{
				type: Schema.Types.ObjectId,
				ref: "Country",
				required: true,
			},
		],
		status: {
			type: String,
			enum: ["active", "inactive"],
			default: "active",
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

const SavingsAccount = mongoose.model("SavingsAccount", savingsAccountSchema);

module.exports = SavingsAccount;
