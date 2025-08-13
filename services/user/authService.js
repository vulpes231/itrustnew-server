const User = require("../../models/User");
const {
	getCountryById,
	getNationById,
	getStateById,
} = require("../locationService");

const bcrypt = require("bcryptjs");
const { getUserById } = require("./userService");

async function registerService(userData) {
	const {
		firstname,
		lastname,
		username,
		email,
		password,
		phone,
		street,
		city,
		zipCode,
		countryId,
		stateId,
		nationalityId,
		dob,
		ssn,
		experience,
		employment,
	} = userData;

	if (!firstname || !lastname) {
		throw new Error("Fullname required!");
	}
	if (!username || !password) {
		throw new Error("Username and password required!");
	}
	if (!email || !phone || !countryId || !stateId || !nationalityId) {
		throw new Error("Contact information required!");
	}

	try {
		const existingUser = await User.find({ username });
		if (existingUser) {
			throw new Error("User already exist!");
		}
		const existingMail = await User.find({ username });
		if (existingMail) {
			throw new Error("Email already in use!");
		}
		const countryInfo = await getCountryById(countryId);
		const stateInfo = await getStateById(stateId);
		const nationInfo = await getNationById(nationalityId);

		const hashPassword = await bcrypt.hash(password, 10);

		const userInfo = {
			name: {
				firstName: firstname,
				lastName: lastname,
			},
			credentials: {
				username: username,
				password: hashPassword,
				email: email,
			},
			contactInfo: {
				phone: phone,
				address: {
					street: street,
					city: city,
					zipCode: zipCode,
				},
			},
			locationDetails: {
				country: {
					countryId: countryInfo._id,
					name: countryInfo.name,
					phoneCode: countryInfo.phoneCode,
				},
				state: {
					stateId: stateInfo._id,
					name: stateInfo.name,
				},
				nationality: {
					id: nationInfo._id,
					name: nationInfo.name,
				},
			},
			personalDetails: {
				dob: dob,
				ssn: ssn || null,
			},
			professionalInfo: {
				experience: experience,
				employment: employment,
			},
		};

		const newUser = await User.create(userInfo);
		const user = await getUserById(newUser._id);
		return {
			username: user.credentials.username,
			email: user.credentials.email,
		};
	} catch (error) {
		console.log("Failed to register user. Try again", error.message);
		throw new Error(error.message);
	}
}

async function loginService(loginData) {}
async function logoutService(userId) {}

module.exports = { registerService, loginService, logoutService };
