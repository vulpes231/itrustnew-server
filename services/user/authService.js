const User = require("../../models/User");
const {
	getCountryById,
	getNationById,
	getStateById,
} = require("../locationService");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { getUserById } = require("./userService");
const { getCurrencyById } = require("../currencyService");
const Wallet = require("../../models/Wallet");
const { sendLoginCode } = require("../mailService");
const Usersetting = require("../../models/Usersetting");

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
		currencyId,
	} = userData;

	if (!firstname || !lastname) {
		throw new Error("Fullname required!");
	}
	if (!username || !password) {
		throw new Error("Username and password required!");
	}
	if (
		!email ||
		!phone ||
		!countryId ||
		!stateId ||
		!nationalityId ||
		!currencyId
	) {
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
		const currencyInfo = await getCurrencyById(currencyId);

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
				currency: {
					id: currencyInfo._id,
					name: currencyInfo.name,
					symbol: currencyInfo.symbol,
					sign: currencyInfo.sign,
					rate: currencyInfo.rate,
					fees: currencyInfo.fees,
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

		const cashWallet = await Wallet.create({
			name: "cash",
			userId: newUser._id,
		});
		const investWallet = await Wallet.create({
			name: "automated investing",
			userId: newUser._id,
		});
		const brokerageWallet = await Wallet.create({
			name: "brokerage",
			userId: newUser._id,
		});

		const userSettings = await Usersetting.create({
			userId: user._id,
		});

		const user = await getUserById(newUser._id);
		return {
			username: user.credentials.username,
			email: user.credentials.email,
			totalBalance:
				cashWallet.totalBalance +
				investWallet.totalBalance +
				brokerageWallet.totalBalance,
		};
	} catch (error) {
		console.log("Failed to register user. Try again", error.message);
		throw new Error(error.message);
	}
}

async function loginService(loginData) {
	const { email, password } = loginData;
	if (!email || !password) {
		throw new Error("Email and password required!");
	}
	try {
		const user = await User.findOne({ email });
		if (!user) {
			throw new Error("User does not exist!");
		}

		const verifyPassword = await bcrypt.compare(
			password,
			user.credentials.password
		);
		if (!verifyPassword) {
			throw new Error("Invalid email or password!");
		}

		if (user.accountStatus.twoFaActivated) {
			const email = user.credentials.email;
			const otp = await sendLoginCode(email);
			user.accountStatus.otp = otp;
			await user.save();

			const userInfo = {
				credentials: {
					username: username,
					email: email,
				},
				identityVerification: {
					kycStatus: user.identityVerification.kycStatus,
				},
				accountStatus: {
					status: user.accountStatus.status,
					banned: user.accountStatus.banned,
					emailVerified: user.accountStatus.emailVerified,
					twoFaActivated: user.accountStatus.twoFaActivated,
					twoFaVerified: user.accountStatus.twoFaVerified,
					otp: user.accountStatus.otp,
				},
			};

			return { userInfo };
		} else {
			const accessToken = jwt.sign(
				{
					username: user.credentials.username,
					userId: user._id,
				},
				process.env.ACCESS_TOKEN_SECRET,
				{ expiresIn: "1d" }
			);
			const refreshToken = jwt.sign(
				{
					username: user.credentials.username,
					userId: user._id,
				},
				process.env.REFRESH_TOKEN_SECRET,
				{ expiresIn: "4d" }
			);

			user.credentials.refreshToken = refreshToken;
			await user.save();

			const userInfo = {
				credentials: {
					username: username,
					email: email,
				},
				identityVerification: {
					kycStatus: user.identityVerification.kycStatus,
				},
				accountStatus: {
					status: user.accountStatus.status,
					banned: user.accountStatus.banned,
					emailVerified: user.accountStatus.emailVerified,
					twoFaActivated: user.accountStatus.twoFaActivated,
				},
			};

			return { accessToken, refreshToken, userInfo };
		}
	} catch (error) {
		console.log("Failed to login user. Try again", error.message);
		throw new Error(error.message);
	}
}

async function logoutService(userId) {
	if (!userId) {
		throw new Error("ID is required!");
	}
	try {
		const user = await User.findById(userId);
		if (!user) {
			throw new Error("User not found!");
		}
		user.credentials.refreshToken = null;
		if (user.accountStatus.twoFaActivated) {
			user.accountStatus.twoFaVerified = false;
		}
		await user.save();
		return true;
	} catch (error) {
		console.log("Failed to logout user. Try again", error.message);
		throw new Error(error.message);
	}
}

module.exports = { registerService, loginService, logoutService };
