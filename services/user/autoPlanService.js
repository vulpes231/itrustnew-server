const Autoplan = require("../../models/Autoplan");
const User = require("../../models/User");
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

async function activatePlan(planId, userId) {
  if (!planId || !userId) throw new CustomError("Bad request!", 400);
  try {
    const plan = await Autoplan.findById(planId);
    if (!plan) throw new CustomError("Plan not found!", 404);

    const user = await User.findById(userId);
    if (!user) throw new CustomError("User not found!", 404);

    const startDate = Date.now();

    const durationMs = getDurationInMs(
      plan.expiresIn.milestone,
      plan.expiresIn.duration
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
      start: Date.now(),
      end: endDate,
      planId: plan._id,
      type: plan.planType,
      analytics: {
        dailyReturn: plan.performance.dailyReturnPercent,
        expectedReturn: plan.performance.expectedReturnPercent,
        winRate: plan.performance.winRate,
      },
    };

    const planExists = user.activePlans.find(
      (p) => p.planId.toString() === planId.toString()
    );

    if (planExists) throw new CustomError("Plan already exists!", 409);

    user.activePlans.push(newPlanData);

    await user.save();

    return plan;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

module.exports = { fetchPlanById, fetchPlans, activatePlan };
