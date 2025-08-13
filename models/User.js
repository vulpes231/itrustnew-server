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
				default: "pending",
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
		},
	},
	{ timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
