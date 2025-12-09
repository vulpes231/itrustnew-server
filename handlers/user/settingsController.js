const settingsService = require("../../services/user/globalSettingsService");

const getGlobalSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings();
    res.status(200).json({
      message: "Settings fetched successfully.",
      data: settings,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getGlobalSettings };
