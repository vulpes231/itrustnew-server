const User = require("../../models/User");
const { CustomError } = require("../../utils/utils");
const bcrypt = require("bcryptjs");

class ChangeEmailService {
  async getMail(userId, email) {
    if (!userId) {
      throw new CustomError("User ID is required!", 400);
    }

    if (!email) {
      throw new CustomError("Email is required!", 400);
    }

    email = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      throw new CustomError("Invalid email address!", 400);
    }

    const user = await User.findById(userId).select(
      "-savingsAccounts -activePlans -credentials",
    );

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    if (user.contactInfo.email === email) {
      throw new CustomError(
        "New email must be different from your current email.",
        400,
      );
    }

    const existingUser = await User.findOne({
      "contactInfo.email": email,
      _id: { $ne: userId },
    });

    if (existingUser) {
      throw new CustomError("Email address is already in use!", 409);
    }

    if (!user.pendingEmailVerification) {
      user.pendingEmailVerification = {};
    }

    user.pendingEmailVerification.email = email;

    await user.save();

    return {
      oldEmail: user.contactInfo.email,
      newEmail: email,
    };
  }

  async verifyMail(userId, code) {
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

      if (
        !user.accountStatus.otp ||
        new Date() > user.accountStatus.otpExpires
      ) {
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

      const newEmail = user.pendingEmailVerification.email;

      user.contactInfo.email = newEmail;

      user.pendingEmailVerification.email = "";
      await user.save();
      return { success: true, user };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw new CustomError(error.message, error.statusCode);
    }
  }
}

module.exports = new ChangeEmailService();
