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
		type: [String],
		default: ["0010"],
		enum: ["0001", "0010"],
	},
});

const Admin = mongoose.model("Admin", adminSchema);
module.exports = Admin;

// enum: ["0010", "0001"],
// default: "0010",
