const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const savingsSchema = new Schema(
	{
		type: {
			type: String,
			required: true,
		},
		accountName: {
			type: String,
			required: true,
		},
		amount: {
			type: Number,
			required: true,
		},
		status: {
			type: String,
			default: "completed",
		},
	},
	{
		timestamps: true,
	}
);

// Indexes
savingsSchema.index({ name: 1 });
savingsSchema.index({ status: 1 });
savingsSchema.index({ interestRate: -1 });

const Saving = mongoose.model("Saving", savingsSchema);
module.exports = Saving;
