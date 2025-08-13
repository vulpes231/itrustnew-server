const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const nationalitySchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

const Nationality = mongoose.model("Nationality", nationalitySchema);
module.exports = Nationality;
