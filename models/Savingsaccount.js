const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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
			},
		},
		eligibleCountries: [
			{
				type: Schema.Types.ObjectId,
				ref: "Country",
			},
		],
		status: {
			type: String,
			enum: ["active", "inactive"],
			default: "active",
		},
	},
	{
		timestamps: true, // Auto-add createdAt and updatedAt
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes
// savingsAccountSchema.index({ name: 1 });
savingsAccountSchema.index({ status: 1 });
savingsAccountSchema.index({ interestRate: -1 });

// Virtual for formatted display
savingsAccountSchema.virtual("displayName").get(function () {
	return `${this.name} (${(this.interestRate * 100).toFixed(2)}%)`;
});

// Pre-save hook to convert HTML note to plain text for description
// savingsAccountSchema.pre("save", function (next) {
// 	if (this.isModified("description")) {
// 		// Simple HTML to text conversion (customize as needed)
// 		this.description = this.description
// 			.replace(/<[^>]*>/g, "") // Remove HTML tags
// 			.replace(/\s+/g, " ") // Collapse whitespace
// 			.trim();
// 	}
// 	next();
// });

const SavingsAccount = mongoose.model("Savingsaccount", savingsAccountSchema);
module.exports = SavingsAccount;
