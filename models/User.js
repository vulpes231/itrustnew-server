const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const userSchema = new Schema(
	{
		firstName: {
			type: String,
		},
		lastName: {
			type: String,
		},
		username: {
			type: String,
		},
		password: {
			type: String,
		},
		email: {
			type: String,
		},
		phone: {
			type: String,
		},
		address: {
			type: String,
		},
		avatar: {
			type: String,
		},
		countryId: {
			type: String,
		},
		stateId: {
			type: String,
		},
		country: {
			type: String,
		},
		city: {
			type: String,
		},
		state: {
			type: String,
		},
		zipCode: {
			type: String,
		},
		ssn: {
			type: String,
		},
		dob: {
			type: String,
		},
		nationality: {
			type: String,
		},
		experience: {
			type: String,
		},
		employment: {
			type: String,
		},
		accountStatus: {
			type: String,
		},
		idNumber: {
			type: String,
		},
		idType: {
			type: String,
		},
		idFront: {
			type: String,
		},
		idBack: {
			type: String,
		},
		kycStatus: {
			type: String,
			enum: ["not verified", "pending", "approved", "failed"],
			default: "pending",
		},
		emailVerified: {
			type: String,
		},
		banned: {
			type: Boolean,
			default: false,
		},
		twoFaActivated: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
