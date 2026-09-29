const adminTierService = require("../../services/admin/manageTierService");

const getAllTiers = async (req, res, next) => {
  try {
    const tiers = await adminTierService.getTiers();
    res.status(200).json({
      message: "Tiers fetched successfully",
      data: tiers,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getTier = async (req, res, next) => {
  const { tierId } = req.params;
  try {
    const tier = await adminTierService.getTierInfo(tierId);
    res.status(200).json({
      message: "Tier fetched successfully",
      data: tier,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const createTier = async (req, res, next) => {
  try {
    const { tier, success } = await adminTierService.createTier(req.body);
    res.status(200).json({
      message: "Tier created successfully",
      data: tier,
      success: success,
    });
  } catch (error) {
    next(error);
  }
};

const updateTier = async (req, res, next) => {
  try {
    const { tier, success } = await adminTierService.updateTier(req.body);
    res.status(200).json({
      message: "Tier updated successfully",
      data: tier,
      success: success,
    });
  } catch (error) {
    next(error);
  }
};

const updateUserTierInfo = async (req, res, next) => {
  try {
    const { success } = await adminTierService.updateUserTier(req.body);
    res.status(200).json({
      message: "User tier updated successfully",
      data: null,
      success: success,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateTier,
  updateUserTierInfo,
  createTier,
  getTier,
  getAllTiers,
};
