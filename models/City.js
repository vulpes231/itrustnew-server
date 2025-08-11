const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const citySchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		stateId: {
			type: String,
			required: true,
		},
		oldId: {
			type: String,
		},
		status: {
			type: String,
			enum: ["active", "inactive"],
			default: "active",
		},
	},
	{
		timestamps: true,
	}
);

const City = mongoose.model("City", citySchema);
module.exports = City;
