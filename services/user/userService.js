const User = require("../../models/User");
const Usersetting = require("../../models/Usersetting");
const bcrypt = require("bcryptjs");

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

async function updateUserProfile(userData) {
	const {
		userId,
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
		const user = await User.findOne({ userId: userId });
		if (!user) {
			throw new Error("user not found");
		}
		if (firstName) {
			user.beneficiary.firstName = firstName;
		}
		if (lastName) {
			user.beneficiary.lastName = lastName;
		}
		if (nationality) {
			user.beneficiary.nationality = nationality;
		}
		if (dob) {
			user.beneficiary.dob = dob;
		}
		if (email) {
			user.beneficiary.contact.email = email;
		}
		if (phone) {
			user.beneficiary.contact.phone = phone;
		}
		if (street) {
			user.beneficiary.address.street = street;
		}
		if (city) {
			user.beneficiary.address.city = city;
		}
		if (state) {
			user.beneficiary.address.state = state;
		}
		if (country) {
			user.beneficiary.address.country = country;
		}
		if (zipCode) {
			user.beneficiary.address.zipCode = zipCode;
		}
		await user.save();
		return user;
	} catch (error) {
		console.log(error);
		throw new Error("Failed to update user!");
	}
}

async function updatePassword(userData) {
	const { userId, password, newPassword } = userData;
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

async function updateBeneficiary(userData) {
	const {
		userId,
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

async function submitDocuments(userId) {
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
};
