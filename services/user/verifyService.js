const User = require("../../models/User");
const jwt = require("jsonwebtoken");
require("dotenv").config();

async function authUser(authData) {
	const { email, code } = authData;
	if (!email || !code) {
		throw new Error("Bad request!");
	}
	try {
		const user = await User.findOne({ email });
		if (!user) {
			throw new Error("User not found!");
		}

		const storedOtp = user.accountStatus.otp;

		if (storedOtp !== code) {
			throw new Error("Invalid OTP!");
		}

		user.accountStatus.twoFaVerified = true;
		user.accountStatus.otp = null;

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
				twoFaVerified: user.accountStatus.twoFaVerified,
			},
		};

		return { accessToken, refreshToken, userInfo };
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to verify login code!");
	}
}

async function verifyMail() {
	const { code, userId } = verifyData;
	if (!userId || !code) {
		throw new Error("Bad request!");
	}
	try {
		const user = await User.findById(userId);
		if (!user) {
			throw new Error("User not found!");
		}

		const storedOtp = user.accountStatus.otp;

		if (storedOtp !== code) {
			throw new Error("Invalid OTP!");
		}

		user.accountStatus.emailVerified = true;
		user.accountStatus.otp = null;

		await user.save();
		return true;
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to verify email!");
	}
}

async function verifyAccount() {}

module.exports = { authUser, verifyMail, verifyAccount };
