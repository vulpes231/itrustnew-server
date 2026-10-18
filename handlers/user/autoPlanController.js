const queueService = require("../../services/queueService");
const {
  fetchPlanById,
  fetchPlans,
  activatePlan,
  getUserPlanInvestment,
} = require("../../services/user/autoPlanService");

const getPlan = async (req, res, next) => {
  const { planId } = req.params;
  try {
    const plan = await fetchPlanById(planId);
    res.status(200).json({
      message: `plan fetched successfully`,
      success: true,
      data: plan,
      formattedDuration: plan.formattedDuration,
    });
  } catch (error) {
    next(error);
  }
};

const getAutoTotalInvested = async (req, res, next) => {
  const { userId } = req.user;
  try {
    const total = await getUserPlanInvestment(userId);
    res.status(200).json({
      message: `plan total fetched successfully`,
      success: true,
      data: total,
    });
  } catch (error) {
    next(error);
  }
};

const startPlan = async (req, res, next) => {
  try {
    const result = await activatePlan({
      ...req.body,
      userId: req.user.userId,
    });

    res.status(200).json({
      message: "Plan started successfully",
      success: true,
      data: null,
    });

    if (result.email && result.username) {
      queueService
        .sendToQueue("email_queue", {
          type: "AUTO_PLAN_EMAIL",
          to: result.email,
          templateData: {
            planName: result.planName,
            username: result.username,
          },
        })
        .catch((error) => {
          console.error("Plan activation email enqueue failed:", error);
        });
    }
  } catch (error) {
    next(error);
  }
};

const getAllPlans = async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 15);
  const sortBy = req.query.sortBy;

  try {
    const { plans, totalPage, totalResult } = await fetchPlans({
      page,
      limit,
      sortBy,
    });
    res.status(200).json({
      success: true,
      data: plans,
      pagination: {
        currentPage: page,
        perPage: limit,
        totalPages: totalPage,
        totalItems: totalResult,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllPlans, getPlan, startPlan, getAutoTotalInvested };
