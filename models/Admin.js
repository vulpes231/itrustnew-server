const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const adminSchema = new Schema({
	username: {
		type: String,
	},
	email: {
		type: String,
	},
	password: {
		type: String,
	},
	refreshToken: {
		type: String,
	},
	role: {
		enum: ["0010", "0001"],
		default: "0010",
		required: true,
		type: String,
	},
});

const Admin = mongoose.model("Admin", adminSchema);
module.exports = Admin;
