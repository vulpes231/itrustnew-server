const User = require("../../models/User");
const Usersetting = require("../../models/Usersetting");
const bcrypt = require("bcryptjs");
const {
	getNationById,
	getCountryById,
	getStateById,
} = require("../locationService");

async function getUserById(userId) {
	if (!userId) throw new Error("Bad request!");
	try {
		const user = await User.findById(userId);
		if (!user) {
			throw new Error("User not found!");
		}
		return user;
	} catch (error) {
		console.log(error.message);
	}
}

async function updateUserProfile(userId, userData) {
	const {
		firstName,
		lastName,
		nationalityId,
		dob,
		email,
		phone,
		street,
		city,
		stateId,
		countryId,
		zipCode,
	} = userData;
	try {
		const user = await User.findOne({ userId: userId });
		if (!user) {
			throw new Error("user not found");
		}

		const nation = await getNationById(nationalityId);
		const country = await getCountryById(countryId);
		const state = await getStateById(stateId);

		if (firstName) {
			user.name.firstName = firstName;
		}
		if (lastName) {
			user.name.lastName = lastName;
		}
		if (nationalityId) {
			user.locationDetails.nationality.id = nation._id;
			user.locationDetails.nationality.name = nation.name;
		}
		if (dob) {
			user.personalDetails.dob = dob;
		}
		if (email) {
			user.credentials.email = email;
		}
		if (phone) {
			user.contactInfo.phone = phone;
		}
		if (street) {
			user.contactInfo.address.street = street;
		}
		if (city) {
			user.contactInfo.address.city = city;
		}
		if (state) {
			user.locationDetails.state.stateId = state._id;
			user.locationDetails.state.name = state.name;
		}
		if (country) {
			user.locationDetails.country.countryId = country._id;
			user.locationDetails.country.name = country.name;
			user.locationDetails.country.phoneCode = country.phoneCode;
		}
		if (zipCode) {
			user.contactInfo.address.zipCode = zipCode;
		}
		await user.save();
		return user;
	} catch (error) {
		console.log(error);
		throw new Error("Failed to update user!");
	}
}

async function updatePassword(userId, userData) {
	const { password, newPassword } = userData;
	if (!userId || !password || !newPassword) throw new Error("Bad request!");
	try {
		const user = await User.findById(userId);
		if (!user) throw new Error("Invalid credentials!");

		const passMatch = await bcrypt.compare(password, user.credentials.password);

		if (!passMatch) throw new Error("Invalid password!");

		const newHashedPass = await bcrypt.hash(newPassword, 10);
		user.credentials.password = newHashedPass;

		await user.save();
		return user;
	} catch (error) {
		console.log(error);
		throw new Error("Failed to update password!");
	}
}

async function updateBeneficiary(userId, userData) {
	const {
		firstName,
		lastName,
		nationality,
		dob,
		email,
		phone,
		street,
		city,
		state,
		country,
		zipCode,
	} = userData;
	try {
		const settings = await Usersetting.findOne({ userId: userId });
		if (!settings) {
			throw new Error("settings not found");
		}
		if (firstName) {
			settings.beneficiary.firstName = firstName;
		}
		if (lastName) {
			settings.beneficiary.lastName = lastName;
		}
		if (nationality) {
			settings.beneficiary.nationality = nationality;
		}
		if (dob) {
			settings.beneficiary.dob = dob;
		}
		if (email) {
			settings.beneficiary.contact.email = email;
		}
		if (phone) {
			settings.beneficiary.contact.phone = phone;
		}
		if (street) {
			settings.beneficiary.address.street = street;
		}
		if (city) {
			settings.beneficiary.address.city = city;
		}
		if (state) {
			settings.beneficiary.address.state = state;
		}
		if (country) {
			settings.beneficiary.address.country = country;
		}
		if (zipCode) {
			settings.beneficiary.address.zipCode = zipCode;
		}
		await settings.save();
		return settings;
	} catch (error) {
		console.log(error);
		throw new Error("Failed to update beneficiary!");
	}
}

async function updateTwoFactorAuth(userId) {
	if (!userId) throw new Error("Bad request!");
	try {
		const user = await User.findById(userId);
		if (!user) {
			throw new Error("Inavlid credentials!");
		}
		user.accountStatus.twoFaActivated = user.accountStatus.twoFaActivated
			? false
			: true;
		await user.save();
		return user;
	} catch (error) {
		console.log(error);
		throw new Error("Failed to update two factor!");
	}
}

async function submitDocuments(verifyData) {
	const { idFront, idBack, firstName, lastName, idType, idNumber, userId } =
		verifyData;
	try {
		const user = await User.findById(userId);
		if (!user) {
			throw new Error("User not found!");
		}
		return user;
	} catch (error) {
		console.log(error.message);
	}
}

module.exports = {
	getUserById,
	updateTwoFactorAuth,
	updateBeneficiary,
	updatePassword,
	updateUserProfile,
};
