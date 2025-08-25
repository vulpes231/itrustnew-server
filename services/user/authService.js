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
const { CustomError } = require("../../utils/utils");

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
		throw new CustomError("Fullname required!", 400);
	}
	if (!username || !password) {
		throw new CustomError("Username and password required!", 400);
	}
	if (
		!email ||
		!phone ||
		!countryId ||
		!stateId ||
		!nationalityId ||
		!currencyId
	) {
		throw new CustomError("Contact information required!", 400);
	}

	try {
		const existingUser = await User.find({ username });
		if (existingUser) {
			throw new CustomError("User already exist!", 409);
		}
		const existingMail = await User.find({ username });
		if (existingMail) {
			throw new CustomError("Email already in use!", 409);
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
		throw new CustomError("Failed to register user! Try again.", 500);
	}
}

async function loginService(loginData) {
	const { email, password } = loginData;
	if (!email || !password) {
		throw new CustomError("Email and password required!", 400);
	}
	try {
		const user = await User.findOne({ email });
		if (!user) {
			throw new CustomError("User does not exist!", 404);
		}

		const verifyPassword = await bcrypt.compare(
			password,
			user.credentials.password
		);
		if (!verifyPassword) {
			throw new CustomError("Invalid email or password!", 400);
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
		throw new CustomError("Failed to login user. Try again", 500);
	}
}

async function logoutService(userId) {
	if (!userId) {
		throw new CustomError("ID is required!", 400);
	}
	try {
		const user = await User.findById(userId);
		if (!user) {
			throw new CustomError("User not found!", 404);
		}
		user.credentials.refreshToken = null;
		if (user.accountStatus.twoFaActivated) {
			user.accountStatus.twoFaVerified = false;
		}
		await user.save();
		return true;
	} catch (error) {
		throw new CustomError("Failed to logout user. Try again", 500);
	}
}

module.exports = { registerService, loginService, logoutService };
