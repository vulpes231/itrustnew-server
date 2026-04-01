const profileOptionService = require("../../services/user/profileSettingsService");

const toggleOptionsTrading = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const status = await profileOptionService.updateOptionsTrading(userId);

    res.status(200).json({
      message: "Options trading status updated.",
      data: status,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const toggleMarginTrading = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const status = await profileOptionService.updateMarginTrading(userId);

    res.status(200).json({
      message: "Margin trading status updated.",
      data: status,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const toggleDripOption = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const status = await profileOptionService.updateDripOption(userId);

    res.status(200).json({
      message: "DRIP trading status updated.",
      data: status,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const toggleEmailNotify = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const status = await profileOptionService.updateEmailNotify(userId);

    res.status(200).json({
      message: "Email notification status updated.",
      data: status,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const toggleOrderNotify = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const status = await profileOptionService.updateOrderNotify(userId);

    res.status(200).json({
      message: "Order notification status updated.",
      data: status,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const togglePriceAlert = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const status = await profileOptionService.updatePriceAlert(userId);

    res.status(200).json({
      message: "Price alert status updated.",
      data: status,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const toggleDeviceAlert = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const status = await profileOptionService.updateLoginAlert(userId);

    res.status(200).json({
      message: "Login alert status updated.",
      data: status,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  toggleOptionsTrading,
  toggleMarginTrading,
  toggleDripOption,
  togglePriceAlert,
  toggleDeviceAlert,
  toggleOrderNotify,
  toggleEmailNotify,
};
