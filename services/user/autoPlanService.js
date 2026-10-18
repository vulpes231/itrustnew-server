const { default: mongoose } = require("mongoose");
const Autoplan = require("../../models/Autoplan");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError, getDurationInMs } = require("../../utils/utils");

async function fetchPlans(queryData) {
  const { page, limit, sortBy } = queryData;
  try {
    const sort = {};
    if (sortBy === "winRate") sort["performance.winRate"] = 1;
    const plans = await Autoplan.find({})
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    const totalResult = await Autoplan.countDocuments();
    const totalPage = Math.ceil(totalResult / limit);
    return { plans, totalResult, totalPage };
  } catch (error) {
    console.log(error);
    throw new CustomError("Failed to fetch auto invest plans! Try again.", 500);
  }
}

async function fetchPlanById(planId) {
  if (!planId) throw new CustomError("Bad request!", 400);
  try {
    const plan = await Autoplan.findById(planId);
    if (!plan) throw new CustomError("Plan not found!", 404);
    return plan;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

async function activatePlan(formData) {
  const { planId, userId, amount } = formData;

  if (!planId || !userId || amount === undefined || amount === null) {
    throw new CustomError("Bad request!", 400);
  }

  const parsedAmt = Number(amount);

  if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
    throw new CustomError("Invalid investment amount!", 400);
  }

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const plan = await Autoplan.findById(planId).session(session);

      if (!plan) {
        throw new CustomError("Plan not found!", 404);
      }

      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new CustomError("User not found!", 404);
      }

      const planExists = user.activePlans.some(
        (p) =>
          p.planId?.toString() === planId.toString() && p.status === "active",
      );

      if (planExists) {
        throw new CustomError("Plan already exists!", 409);
      }

      const wallet = await Wallet.findOne({
        userId,
        slug: "auto",
      }).session(session);

      if (!wallet) {
        throw new CustomError("Wallet not found!", 404);
      }

      if (wallet.balance.available < parsedAmt) {
        throw new CustomError("Insufficient funds!", 400);
      }

      const startDate = Date.now();

      const durationMs = getDurationInMs(
        plan.expiresIn.milestone,
        plan.expiresIn.duration,
      );

      const endDate = startDate + durationMs;

      const newPlanData = {
        name: plan.name,
        title: plan.title,
        status: "active",
        aum: plan.performance.aum,
        min: plan.minInvestment,
        image: plan.img,
        duration: `${plan.expiresIn.milestone} ${plan.expiresIn.duration}`,
        start: startDate,
        end: endDate,
        planId: plan._id,
        type: plan.planType,
        analytics: {
          dailyReturn: plan.performance.dailyReturnPercent,
          expectedReturn: plan.performance.expectedReturnPercent,
          winRate: plan.performance.winRate,
        },
        balance: {
          total: parsedAmt,
          available: parsedAmt,
        },
        performance: {
          totalReturn: 0,
          totalReturnPercent: 0,
          dailyReturn: 0,
          dailyreturnPercent: 0,
        },
        risk: plan.planType,
      };

      // Every database write must use the same session.
      wallet.balance.available -= parsedAmt;
      await wallet.save({ session });

      user.activePlans.push(newPlanData);
      await user.save({ session });

      result = {
        planName: plan.name,
        success: true,
        username: user.personalInfo.username,
        email: user.contactInfo.email,
      };
    });

    // withTransaction resolves after a successful commit.
    return result;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(
      error.message || "Failed to activate plan",
      error.statusCode || 500,
    );
  } finally {
    await session.endSession();
  }
}

async function getUserPlanInvestment(userId) {
  if (!userId) throw new CustomError("Bad request!", 400);

  try {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("User not found!", 404);

    const userPlans = user.activePlans;

    const activePlans = userPlans.filter((plan) => plan.status === "active");

    const totalInvested = activePlans.reduce(
      (sum, plan) => sum + (plan.analytics.balance.total || 0),
      0,
    );
    return totalInvested;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError("Failed to fetch plan total", error.statusCode);
  }
}

module.exports = {
  fetchPlanById,
  fetchPlans,
  activatePlan,
  getUserPlanInvestment,
};
