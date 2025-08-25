const User = require("../../models/User");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { CustomError } = require("../../utils/utils");

async function authUser(authData) {
	const { email, code } = authData;
	if (!email || !code) {
		throw new CustomError("Bad request!", 400);
	}
	try {
		const user = await User.findOne({ email });
		if (!user) throw new CustomError("Invalid credentials", 404); // Generic error

		if (
			user.accountStatus.otpBlockedUntil &&
			new Date() < user.accountStatus.otpBlockedUntil
		) {
			throw new CustomError("Too many attempts. Try again later.", {
				statusCode: 403,
			});
		}

		// Check OTP expiry
		if (!user.accountStatus.otp || new Date() > user.accountStatus.otpExpires) {
			throw new CustomError("OTP expired or invalid", 400);
		}

		// Verify OTP
		const otpMatch = await bcrypt.compare(code, user.accountStatus.otp);

		if (!otpMatch) {
			// Increment failed attempts
			user.accountStatus.otpAttempts += 1;

			// Block after 3 failed attempts for 15 mins
			if (user.accountStatus.otpAttempts >= 3) {
				user.accountStatus.otpBlockedUntil = new Date(
					Date.now() + 15 * 60 * 1000
				);
			}

			await user.save();
			throw new CustomError("Invalid OTP", 400);
		}

		user.accountStatus.otp = null;
		user.accountStatus.otpExpires = null;
		user.accountStatus.otpAttempts = 0;
		user.accountStatus.otpBlockedUntil = null;
		user.accountStatus.twoFaVerified = true;

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
		throw new CustomError("Failed to verify login code!", 500);
	}
}

async function verifyMail() {
	const { code, userId } = verifyData;
	if (!userId || !code) {
		throw new CustomError("Bad request!", 400);
	}
	try {
		const user = await User.findById(userId);
		if (!user) throw new CustomError("Invalid credentials", 404); // Generic error

		if (
			user.accountStatus.otpBlockedUntil &&
			new Date() < user.accountStatus.otpBlockedUntil
		) {
			throw new CustomError("Too many attempts. Try again later.", {
				statusCode: 403,
			});
		}

		// Check OTP expiry
		if (!user.accountStatus.otp || new Date() > user.accountStatus.otpExpires) {
			throw new CustomError("OTP expired or invalid", 400);
		}

		// Verify OTP
		const otpMatch = await bcrypt.compare(code, user.accountStatus.otp);

		if (!otpMatch) {
			// Increment failed attempts
			user.accountStatus.otpAttempts += 1;

			// Block after 3 failed attempts for 15 mins
			if (user.accountStatus.otpAttempts >= 3) {
				user.accountStatus.otpBlockedUntil = new Date(
					Date.now() + 15 * 60 * 1000
				);
			}

			await user.save();
			throw new CustomError("Invalid OTP", 400);
		}

		user.accountStatus.otp = null;
		user.accountStatus.otpExpires = null;
		user.accountStatus.otpAttempts = 0;
		user.accountStatus.otpBlockedUntil = null;
		user.accountStatus.twoFaVerified = true;

		await user.save();
		return true;
	} catch (error) {
		throw new CustomError("Failed to verify email!", 500);
	}
}

async function verifyAccount() {}

module.exports = { authUser, verifyMail };
