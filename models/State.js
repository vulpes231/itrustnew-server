const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const stateSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		countryId: {
			type: Schema.Types.ObjectId,
			ref: "Country",
			required: true,
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

const State = mongoose.model("State", stateSchema);
module.exports = State;
