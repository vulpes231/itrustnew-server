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
	},
	{
		timestamps: true,
	}
);

const Country = mongoose.model("Country", countrySchema);
module.exports = Country;
