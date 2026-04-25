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
          Date.now() + 15 * 60 * 1000,
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
        username: user.personalInfo.username,
        userId: user._id,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1d" },
    );
    const refreshToken = jwt.sign(
      {
        username: user.personalInfo.username,
        userId: user._id,
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "4d" },
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
        twoFaVerified: user.accountStatus.twoFaVerified,
        isPersonalComplete: user.personalInfo.isPersonalComplete,
      },
    };

    return { accessToken, refreshToken, userInfo };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function verifyMail(verifyData) {
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
          Date.now() + 15 * 60 * 1000,
        );
      }

      await user.save();
      throw new CustomError("Invalid OTP", 400);
    }

    user.accountStatus.otp = null;
    user.accountStatus.otpExpires = null;
    user.accountStatus.otpAttempts = 0;
    user.accountStatus.otpBlockedUntil = null;
    user.accountStatus.emailVerified = true;
    user.accountStatus.otpSentAt = null;

    await user.save();
    return true;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function submitVerification(userData) {
  const { userId, frontId, backId, idType, frontIdName, backIdName } = userData;

  if (!idType || !userId || !frontId || !frontIdName)
    throw new CustomError("Bad request, Imcomplete data!", 400);
  try {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("User not found!", 404);

    await Verification.create({
      userId,
      frontId,
      backId,
      fullname: user.fullName,
      idType,
      frontIdName,
      backIdName,
    });

    user.identityVerification.idType = idType;
    user.identityVerification.kycStatus = "pending";
    await user.save();
    return true;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function getUserVerifyInfo(userId) {
  if (!userId) throw new CustomError("Bad request!", 400);
  try {
    const verifyInfo = await Verification.findOne({ userId }).lean();
    if (!verifyInfo) throw new CustomError("Data not found!", 404);
    return verifyInfo;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function submitAddressProof(userData) {
  const { userId, docPath, idType } = userData;
  if (!docPath) throw new CustomError("Bad request!", 400);
  try {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("User not found!", 404);

    user.contactInfo.status = "pending";
    user.contactInfo.docPath = docPath;
    user.contactInfo.idType = idType;
    await user.save();
    return { status: user.contactInfo.status };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, error.statusCode);
  }
}

module.exports = {
  authUser,
  verifyMail,
  submitVerification,
  getUserVerifyInfo,
  submitAddressProof,
};
