const Tier = require("../../models/Tier");
const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const { CustomError } = require("../../utils/utils");
const { getUserFinancialSummary } = require("./walletService");

class UserTierService {
  /**
   * Get the effective tiers for a user.
   *
   * Global Tier values are used by default.
   * User-specific values override global values only when they are > 0.
   *
   * Example:
   *
   * Global:
   * Tier 1 threshold = 10
   *
   * User:
   * Tier 1 threshold = 15
   *
   * Effective:
   * Tier 1 threshold = 15
   */
  async getTiers(userId) {
    const globalTiers = await Tier.find().sort({ createdAt: 1 }).lean();

    if (!userId) {
      return globalTiers;
    }

    const user = await User.findById(userId).select("tiers accountTier").lean();

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    const userTiers = user.tiers || [];

    const effectiveTiers = globalTiers.map((globalTier) => {
      const userTier = userTiers.find((tier) => tier.tag === globalTier.tag);

      const userThreshold = Number(userTier?.threshold);
      const userMinDeposit = Number(userTier?.minDeposit);

      return {
        ...globalTier,

        // User override only when > 0.
        threshold:
          userThreshold > 0 ? userThreshold : Number(globalTier.threshold),

        minDeposit:
          userMinDeposit > 0 ? userMinDeposit : Number(globalTier.minDeposit),

        // Allow user-specific title/features when present.
        title: userTier?.title?.trim() ? userTier.title : globalTier.title,

        features:
          Array.isArray(userTier?.features) && userTier.features.length > 0
            ? userTier.features
            : globalTier.features || [],
      };
    });

    return effectiveTiers;
  }

  /**
   * Get a single global tier.
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
   * Update the user's permanent tier progress.
   *
   * IMPORTANT:
   *
   * eligibleTier = what the user qualifies for RIGHT NOW.
   *
   * currentTier = the highest tier the user has EVER achieved.
   *
   * currentTier can only increase.
   */
  async updateTierProgress(userId) {
    if (!userId) {
      throw new CustomError("User ID is required!", 400);
    }

    const user = await User.findById(userId).select("tiers accountTier");

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    /*
     * Get the user's actual financial balance.
     *
     * This prevents tier logic from having its own separate
     * balance calculation that could disagree with the dashboard.
     */
    const financialSummary = await getUserFinancialSummary(userId);

    const totalBalance = Number(financialSummary.totalBalance) || 0;

    /*
     * Get effective tiers:
     *
     * global tier
     * +
     * user-specific overrides
     */
    const effectiveTiers = await this.getTiers(userId);

    /*
     * Determine the highest tier the user's CURRENT balance qualifies for.
     *
     * Example:
     *
     * Tier 1 = 10
     * Tier 2 = 20
     * Tier 3 = 30
     *
     * Balance = 25
     *
     * eligibleTier = 2
     */
    let eligibleTier = 0;

    effectiveTiers.forEach((tier, index) => {
      const threshold = Number(tier.threshold) || 0;

      if (totalBalance >= threshold) {
        eligibleTier = index + 1;
      }
    });

    /*
     * The stored tier is permanent progression.
     */
    const currentTier = Number(user.accountTier?.currentTier) || 0;

    /*
     * ONLY upgrade.
     *
     * Never do:
     *
     * currentTier = eligibleTier
     *
     * because that would allow downgrades.
     */
    if (eligibleTier > currentTier) {
      if (!user.accountTier) {
        user.accountTier = {};
      }

      user.accountTier.currentTier = eligibleTier;

      await user.save();
    }

    return {
      currentTier: Math.max(currentTier, eligibleTier),

      eligibleTier,

      totalBalance,

      upgraded: eligibleTier > currentTier,
    };
  }

  /**
   * Submit withdrawal code.
   */
  async submitWithdrawalCode(formData) {
    const { userId, code } = formData;

    if (!userId || !code) {
      throw new CustomError("Withdrawal code required!", 400);
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    if (!user.accountTier?.isCodeActivated) {
      throw new CustomError("Contact admin", 400);
    }

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
