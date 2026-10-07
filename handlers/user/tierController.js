// const adminTierService = require("../../services/admin/manageTierService");
const userTierService = require("../../services/user/tierService");

const getAvailableTiers = async (req, res, next) => {
  const { userId } = req.user;
  try {
    const tiers = await userTierService.getTiers(userId);
    res.status(200).json({
      message: "Tiers fetched successfully",
      data: tiers,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getTierById = async (req, res, next) => {
  const { tierId } = req.params;
  try {
    const tier = await userTierService.getTierInfo(tierId);
    res.status(200).json({
      message: "Tier fetched successfully",
      data: tier,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const submitTierCode = async (req, res, next) => {
  const { code } = req.body;
  const { userId } = req.user;
  try {
    const { success } = await userTierService.submitWithdrawalCode({
      userId,
      code,
    });
    res.status(200).json({
      message: "Tier code submitted successfully",
      data: null,
      success: success,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTierById,
  getAvailableTiers,
  submitTierCode,
};
