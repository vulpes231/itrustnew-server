const Tier = require("../../models/Tier");
const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const { CustomError } = require("../../utils/utils");

class UserTierService {
  async getTiers() {
    const tiers = await Tier.find().lean();
    return tiers;
  }

  async getTierInfo(tierId) {
    if (!tierId) {
      throw new CustomError("Tier ID required!", 400);
    }

    const tier = await Tier.findById(tierId);

    return tier;
  }

  async submitWithdrawalCode(formData) {
    const { userId, code } = formData;

    if (!userId || !code) {
      throw new CustomError("Withdrawal code required!", 400);
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    // if (!user.accountTier?.tierId) {
    //   throw new CustomError("User tier not configured!", 400);
    // }

    // const userTier = await Tier.findById(user.accountTier.tierId);

    // if (!userTier) {
    //   throw new CustomError("Tier not found!", 404);
    // }

    if (!user.accountTier.isCodeActivated) {
      throw new CustomError("Contact admin", 400);
    }

    // if (!user.accountTier.withdrawalCode) {
    //   throw new CustomError("Withdrawal code not configured!", 400);
    // }

    const isCodeValid = await bcrypt.compare(
      String(code),
      user.accountTier.withdrawalCode,
    );

    if (!isCodeValid) {
      throw new CustomError("Invalid withdrawal code", 400);
    }

    return {
      success: true,
    };
  }
}

module.exports = new UserTierService();
