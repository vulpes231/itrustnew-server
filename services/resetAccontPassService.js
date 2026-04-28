const User = require("../models/User");
const { CustomError } = require("../utils/utils");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

async function confirmEmailOwnership(resetData) {
  const { code, email } = resetData;
  if (!code || !email) throw new CustomError("Bad request!", 400);
  try {
    const user = await User.findOne({ "contactInfo.email": email }).select(
      "-savingsAccounts -activePlans -employmentInfo -investmentInfo",
    );
    if (!user) throw new CustomError("User not found!", 404);

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
    user.accountStatus.otpSentAt = null;

    await user.save();

    const resetPassToken = jwt.sign(
      {
        userId: user._id,
        email: user.contactInfo.email,
      },
      process.env.RESET_PASS_TOKEN_SECRET,
      { expiresIn: "5m" },
    );
    return resetPassToken;
  } catch (emailResetError) {
    console.log(emailResetError);
    if (emailResetError instanceof CustomError) throw emailResetError;
    throw new CustomError(emailResetError.message, emailResetError.statusCode);
  }
}

async function changeAccountPass(resetData) {
  const { oldPass, newPass, userId } = resetData;
  if (!newPass || !oldPass) throw new CustomError("Bad request!", 400);
  try {
    const user = await User.findById(userId).select(
      "-savingsAccounts -activePlans -employmentInfo -investmentInfo",
    );
    if (!user) throw new CustomError("User not found!", 404);

    const oldPassMatch = await bcrypt.compare(
      oldPass,
      user.credentials.password,
    );

    if (!oldPassMatch) throw new CustomError("Invalid Old Password!", 404);

    const newPassHash = await bcrypt.hash(newPass, 10);

    user.credentials.password = newPassHash;
    user.credentials.passUpdatedAt = new Date();

    await user.save();

    return {
      message: "Password changed",
    };
  } catch (passResetError) {
    if (passResetError instanceof CustomError) throw passResetError;
    throw new CustomError(passResetError.message, passResetError.statusCode);
  }
}

module.exports = { changeAccountPass, confirmEmailOwnership };
