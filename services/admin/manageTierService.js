const Tier = require("../../models/Tier");
const User = require("../../models/User");
const { CustomError } = require("../../utils/utils");
const bcrypt = require("bcryptjs");

const userTierService = require("../user/tierService");

class AdminTierService {
  /**
   * Get all global tiers.
   */
  async getTiers() {
    const tiers = await Tier.find().sort({ createdAt: 1 }).lean();

    return tiers;
  }

  /**
   * Get one global tier.
   */
  async getTierInfo(tierId) {
    if (!tierId) {
      throw new CustomError("Tier ID required!", 400);
    }

    const tier = await Tier.findById(tierId);

    if (!tier) {
      throw new CustomError("Tier not found!", 404);
    }

    return tier;
  }

  /**
   * Create a global tier.
   */
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

    const parsedThreshold = Number(threshold);
    const parsedMinDeposit = Number(minDeposit);

    if (
      !Number.isFinite(parsedThreshold) ||
      !Number.isFinite(parsedMinDeposit)
    ) {
      throw new CustomError(
        "Threshold and minimum deposit must be valid numbers!",
        400,
      );
    }

    if (parsedThreshold < 0 || parsedMinDeposit < 0) {
      throw new CustomError(
        "Threshold and minimum deposit cannot be negative!",
        400,
      );
    }

    /*
     * Prevent duplicate tier tags.
     */
    const existingTier = await Tier.findOne({ tag });

    if (existingTier) {
      throw new CustomError("A tier with this tag already exists!", 409);
    }

    const newTierData = {
      title,
      tag,
      threshold: parsedThreshold,
      minDeposit: parsedMinDeposit,
      features: Array.isArray(features) ? features : [],
    };

    const createdTier = await Tier.create(newTierData);

    return {
      success: true,
      tier: createdTier,
    };
  }

  /**
   * Update a global tier.
   */
  async updateTier(formData) {
    const { title, tag, threshold, minDeposit, tierId } = formData;

    if (!tierId) {
      throw new CustomError("Tier ID required!", 400);
    }

    const tier = await this.getTierInfo(tierId);

    let thresholdChanged = false;

    if (title !== undefined) {
      tier.title = title;
    }

    if (tag !== undefined) {
      const duplicateTier = await Tier.findOne({
        tag,
        _id: { $ne: tierId },
      });

      if (duplicateTier) {
        throw new CustomError("A tier with this tag already exists!", 409);
      }

      tier.tag = tag;
    }

    if (minDeposit !== undefined && minDeposit !== null) {
      const parsedMinDeposit = Number(minDeposit);

      if (!Number.isFinite(parsedMinDeposit)) {
        throw new CustomError("Minimum deposit must be a valid number!", 400);
      }

      if (parsedMinDeposit < 0) {
        throw new CustomError("Minimum deposit cannot be negative!", 400);
      }

      tier.minDeposit = parsedMinDeposit;
    }

    if (threshold !== undefined && threshold !== null) {
      const parsedThreshold = Number(threshold);

      if (!Number.isFinite(parsedThreshold)) {
        throw new CustomError("Threshold must be a valid number!", 400);
      }

      if (parsedThreshold < 0) {
        throw new CustomError("Threshold cannot be negative!", 400);
      }

      if (tier.threshold !== parsedThreshold) {
        thresholdChanged = true;
      }

      tier.threshold = parsedThreshold;
    }

    if (formData.features !== undefined) {
      tier.features = Array.isArray(formData.features) ? formData.features : [];
    }

    await tier.save();

    // Only threshold changes can affect tier progression.
    if (thresholdChanged) {
      await this.recalculateUsersForGlobalTier(tier.tag);
    }

    return {
      success: true,
      tier,
    };
  }

  async recalculateUsersForGlobalTier(tierTag) {
    const BATCH_SIZE = 100;

    const users = await User.find({
      "tiers.tag": tierTag,
    }).select("_id");

    let processed = 0;
    let upgraded = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (user) => {
          const result = await userTierService.updateTierProgress(user._id);

          if (result.upgraded) {
            upgraded++;
          }

          return result;
        }),
      );

      results.forEach((result) => {
        if (result.status === "rejected") {
          failed++;

          console.error("Failed to update tier progress:", result.reason);
        }
      });

      processed += batch.length;

      console.log(`Tier recalculation: ${processed}/${users.length}`);
    }

    return {
      processed,
      upgraded,
      failed,
    };
  }

  /**
   * Update a user's tier-specific overrides.
   */
  async updateUserTier(formData) {
    const {
      threshold,
      minDeposit,
      userId,
      isCodeActivated,
      code,
      tierId,
      tag,
    } = formData;

    if (!userId) {
      throw new CustomError("User ID required!", 400);
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    if (!Array.isArray(user.tiers)) {
      throw new CustomError("User does not have tier configuration!", 400);
    }

    let tierToUpdate;

    if (tag) {
      tierToUpdate = user.tiers.find((tier) => tier.tag === tag);
    } else if (tierId) {
      tierToUpdate = user.tiers.find(
        (tier) => tier._id.toString() === tierId.toString(),
      );
    }

    if (!tierToUpdate) {
      throw new CustomError("Tier not found!", 404);
    }

    if (threshold !== undefined && threshold !== null) {
      const parsedThreshold = Number(threshold);

      if (!Number.isFinite(parsedThreshold)) {
        throw new CustomError("Threshold must be a valid number!", 400);
      }

      if (parsedThreshold < 0) {
        throw new CustomError("Threshold cannot be negative!", 400);
      }

      tierToUpdate.threshold = parsedThreshold;
    }

    if (minDeposit !== undefined && minDeposit !== null) {
      const parsedMinDeposit = Number(minDeposit);

      if (!Number.isFinite(parsedMinDeposit)) {
        throw new CustomError("Minimum deposit must be a valid number!", 400);
      }

      if (parsedMinDeposit < 0) {
        throw new CustomError("Minimum deposit cannot be negative!", 400);
      }

      tierToUpdate.minDeposit = parsedMinDeposit;
    }

    if (formData.title !== undefined) {
      tierToUpdate.title = formData.title;
    }

    if (formData.features !== undefined) {
      tierToUpdate.features = Array.isArray(formData.features)
        ? formData.features
        : [];
    }

    if (code !== undefined && code !== null) {
      const hashedCode = await bcrypt.hash(String(code), 10);

      if (!user.accountTier) {
        user.accountTier = {};
      }

      user.accountTier.withdrawalCode = code;
    }

    if (isCodeActivated !== undefined) {
      if (!user.accountTier) {
        user.accountTier = {};
      }

      user.accountTier.isCodeActivated = Boolean(isCodeActivated);
    }

    await user.save();
    await userTierService.updateTierProgress(user._id);

    return {
      success: true,
      tier: tierToUpdate,
    };
  }
}

module.exports = new AdminTierService();
