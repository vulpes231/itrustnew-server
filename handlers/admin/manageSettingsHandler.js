const adminManageSettings = require("../../services/admin/manageSettingsService");

const createSettings = async (req, res, next) => {
  const data = req.body;
  try {
    await adminManageSettings.createSettings(data);
    res.status(200).json({
      message: "Settings created successfully.",
      data: null,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const updateBank = async (req, res, next) => {
  const data = req.body;
  try {
    const settings = await adminManageSettings.editBank(data);
    res.status(200).json({
      message: "Bank settings updated successfully.",
      data: settings,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const updateWallet = async (req, res, next) => {
  const data = req.body;
  try {
    const settings = await adminManageSettings.editWallets(data);
    res.status(200).json({
      message: "Wallet settings updated successfully.",
      data: settings,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const updateLimits = async (req, res, next) => {
  const data = req.body;
  try {
    const settings = await adminManageSettings.editLimit(data);
    res.status(200).json({
      message: `${req.body.method} limits updated successfully.`,
      data: settings,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createSettings, updateBank, updateWallet, updateLimits };
