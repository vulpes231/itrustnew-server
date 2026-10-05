const Tier = require("../../models/Tier");
const User = require("../../models/User");
const { CustomError } = require("../../utils/utils");
const bcrypt = require("bcryptjs");

class AdminTierService {
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

  async createTier(formData) {
    const { title, tag, threshold, features, minDeposit } = formData;

    if (
      !title ||
      !tag ||
      threshold === undefined ||
      threshold === null ||
      minDeposit === undefined ||
      minDeposit === null
    ) {
      throw new CustomError("Incomplete data!", 400);
    }

    const newTierData = {
      title,
      tag,
      threshold: Number(threshold),
      minDeposit: Number(minDeposit),
      features: Array.isArray(features) ? features : [],
    };

    const createdTier = await Tier.create(newTierData);

    return {
      success: true,
      tier: createdTier,
    };
  }

  async updateTier(formData) {
    const { title, tag, threshold, minDeposit, tierId } = formData;

    if (!tierId) {
      throw new CustomError("Tier ID required!", 400);
    }

    const tier = await this.getTierInfo(tierId);

    if (!tier) {
      throw new CustomError("Tier not found!", 404);
    }

    if (title !== undefined) {
      tier.title = title;
    }

    if (tag !== undefined) {
      tier.tag = tag;
    }

    if (minDeposit !== undefined && minDeposit !== null) {
      tier.minDeposit = Number(minDeposit);
    }

    if (threshold !== undefined && threshold !== null) {
      tier.threshold = Number(threshold);
    }

    await tier.save();

    return {
      success: true,
      tier,
    };
  }

  async updateUserTier(formData) {
    const { threshold, minDeposit, userId, isCodeActivated, code, tierId } =
      formData;

    if (!userId) {
      throw new CustomError("Bad request!", 400);
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    const tiers = user.tiers;

    const tierToUpdate = tiers.find(
      (tr) => tr._id.toString() === tierId.toString(),
    );

    if (!tierToUpdate) {
      throw new CustomError("Tier not found!", 404);
    }

    if (!user.accountTier) {
      user.accountTier = {};
    }

    if (minDeposit !== undefined && minDeposit !== null) {
      tierToUpdate.minDeposit = Number(minDeposit);
    }

    if (threshold !== undefined && threshold !== null) {
      tierToUpdate.threshold = Number(threshold);
    }

    if (code !== undefined && code !== null) {
      user.accountTier.withdrawalCode = code;
    }

    if (isCodeActivated !== undefined) {
      user.accountTier.isCodeActivated = isCodeActivated;
    }

    await user.save();

    return {
      success: true,
      // user,
    };
  }
}

module.exports = new AdminTierService();
