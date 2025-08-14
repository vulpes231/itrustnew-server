const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
	{
		name: {
			firstName: {
				type: String,
				required: true,
			},
			lastName: {
				type: String,
				required: true,
			},
		},
		credentials: {
			username: {
				type: String,
				required: true,
				unique: true,
			},
			password: {
				type: String,
				required: true,
			},
			email: {
				type: String,
				required: true,
				unique: true,
			},
			refreshToken: {
				type: String,
			},
		},
		contactInfo: {
			phone: {
				type: String,
			},
			address: {
				street: {
					type: String,
				},
				city: {
					type: String,
				},
				zipCode: {
					type: String,
				},
			},
		},
		locationDetails: {
			country: {
				countryId: { type: Schema.Types.ObjectId, ref: "Country" },
				name: { type: String },
				phoneCode: { type: String },
			},
			state: {
				stateId: { type: Schema.Types.ObjectId, ref: "State" },
				name: { type: String },
			},
			nationality: {
				id: { type: Schema.Types.ObjectId, ref: "Nationality" },
				name: { type: String },
			},
			currency: {
				id: { type: Schema.Types.ObjectId, ref: "Currency" },
				name: { type: String },
				symbol: { type: String },
				sign: { type: String },
				rate: { type: String },
			},
		},
		personalDetails: {
			avatar: {
				type: String,
			},
			dob: {
				type: Date,
			},
			ssn: {
				type: String,
			},
		},
		professionalInfo: {
			experience: {
				type: String,
			},
			employment: {
				type: String,
			},
		},
		identityVerification: {
			idType: {
				type: String,
			},
			idNumber: {
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
				default: "not verified",
			},
		},
		accountStatus: {
			status: {
				type: String,
			},
			banned: {
				type: Boolean,
				default: false,
			},
			emailVerified: {
				type: Boolean,
				default: false,
			},
			twoFaActivated: {
				type: Boolean,
				default: false,
			},
			twoFaVerified: {
				type: Boolean,
				default: false,
			},
			otp: {
				type: String,
			},
			otpExpires: {
				type: Date,
			},
			otpAttempts: {
				type: Number,
				default: 0,
			},
			otpBlockedUntil: {
				type: Date,
			},
		},
	},
	{ timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
