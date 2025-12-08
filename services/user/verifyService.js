const User = require("../../models/User");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { CustomError } = require("../../utils/utils");
const Verification = require("../../models/Verification");

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
    if (!user) throw new CustomError("Invalid credentials", 404);

    if (
      user.accountStatus.otpBlockedUntil &&
      new Date() < user.accountStatus.otpBlockedUntil
    ) {
      throw new CustomError("Too many attempts. Try again later.", {
        statusCode: 403,
      });
    }

    if (!user.accountStatus.otp || new Date() > user.accountStatus.otpExpires) {
      throw new CustomError("OTP expired or invalid", 400);
    }

    const otpMatch = await bcrypt.compare(code, user.accountStatus.otp);

    if (!otpMatch) {
      user.accountStatus.otpAttempts += 1;

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
    throw new CustomError(error.message, error.statusCode);
  }
}

async function submitVerification(userData) {
  const {
    userId,
    frontId,
    backId,
    lastname,
    firstname,
    idType,
    idNumber,
    frontIdName,
    backIdName,
  } = userData;

  if (!idType || !idNumber || !firstname || !lastname || !userId)
    throw new CustomError("Bad request!", 400);
  try {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("User not found!", 404);

    await Verification.create({
      userId,
      frontId,
      backId,
      fullname: `${firstname} ${lastname}`,
      idType,
      idNumber,
      frontIdName,
      backIdName,
    });

    user.identityVerification.kycStatus = "pending";
    await user.save();
    return true;
  } catch (error) {
    console.log(error);
    throw new CustomError(error.message, error.statusCode);
  }
}

module.exports = { authUser, verifyMail, submitVerification };
