const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const walletSchema = new Schema(
	{
		name: {
			type: String,
		},
		balance: {
			type: Number,
		},
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		created: {
			type: String,
		},
		updated: {
			type: String,
		},
	},
	{ timestamps: true }
);
