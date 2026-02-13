const {
  configureUserLimits,
  configureBankDeposit,
  configureWalletAddress,
  configureUserInfo,
} = require("../../services/admin/manageUserConfigService");

const updateUserLimits = async (req, res, next) => {
  const formData = req.body;
  try {
    const settings = await configureUserLimits(formData);
    res.status(200).json({
      success: true,
      data: settings,
      message: "Limits updated succesfully",
    });
  } catch (error) {
    next(error);
  }
};

const updateBankInfo = async (req, res, next) => {
  const formData = req.body;
  try {
    const settings = await configureBankDeposit(formData);
    res.status(200).json({
      success: true,
      data: settings,
      message: "Bank updated succesfully",
    });
  } catch (error) {
    next(error);
  }
};

const updateCryptoInfo = async (req, res, next) => {
  const formData = req.body;
  try {
    const settings = await configureWalletAddress(formData);
    res.status(200).json({
      success: true,
      data: settings,
      message: "Wallet updated succesfully",
    });
  } catch (error) {
    next(error);
  }
};

const userConfigUpdate = async (req, res, next) => {
  const formData = req.body;
  try {
    const user = await configureUserInfo(formData);
    res.status(200).json({
      success: true,
      data: user,
      message: "User updated succesfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateBankInfo,
  updateCryptoInfo,
  userConfigUpdate,
  updateUserLimits,
};
