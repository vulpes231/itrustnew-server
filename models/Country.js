const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const countrySchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		phoneCode: {
			type: String,
			required: true,
		},
		oldId: {
			type: String,
		},
		status: {
			type: String,
			default: "active",
			enum: ["active", "inactive"],
		},
	},
	{
		timestamps: true,
	}
);

const Country = mongoose.model("Country", countrySchema);
module.exports = Country;
