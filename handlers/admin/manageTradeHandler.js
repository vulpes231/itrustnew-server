const User = require("../../models/User");
const tradeService = require("../../services/admin/manageTradeService");
const queueService = require("../../services/queueService");

const addNewTrade = async (req, res, next) => {
  const tradeData = req.body;

  try {
    const result = await tradeService.createBuyTrade(tradeData);

    if (result.success && tradeData.notifyUser) {
      await queueService.sendToQueue("email_queue", {
        type: "TRADE_EMAIL",
        to: result.email,
        templateData: {
          trade: result.trade,
        },
      });
    }
    res.status(200).json({
      message: "Trade created successfully.",
      data: result.trade,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const exitTrade = async (req, res, next) => {
  const { tradeId } = req.params;
  const { amount, notifyUser } = req.body;

  try {
    const result = await tradeService.closeTrade({
      tradeId,
      percentToClose: amount || 100,
    });

    const user = await User.findById(result.trade.userId).lean();
    if (!user) {
      throw new CustomError("User not found!", 400);
    }

    const userEmail = user.contactInfo.email;

    if (result.success && notifyUser) {
      await queueService.sendToQueue("email_queue", {
        type: "TRADE_EMAIL",
        to: userEmail,
        templateData: {
          trade: result.trade,
          closedPortion: result.closedPortion,
          isPartialClose: result.closedPortion.percentClosed !== 100,
        },
      });
    }

    res.status(200).json({
      message:
        result.closedPortion.percentClosed === 100
          ? "Trade closed successfully."
          : `${result.closedPortion.percentClosed}% of trade closed successfully.`,
      data: result,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const updateTrade = async (req, res, next) => {
  const tradeData = req.body;
  const { tradeId } = req.params;

  try {
    const trade = await tradeService.editTrade({ ...tradeData, tradeId });
    res.status(200).json({
      message: "Trade updated successfully.",
      data: trade,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getTradeInfo = async (req, res, next) => {
  const { tradeId } = req.params;
  try {
    const trade = await tradeService.getTradeById(tradeId);
    res.status(200).json({
      message: "Trade info fetched successfully.",
      data: trade,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getAllTrades = async (req, res, next) => {
  const page = Math.max(1, req.query.page || 1);
  const limit = Math.min(15, req.query.limit || 15);
  const sortBy = req.query.sortBy || "createdAt";
  const filterBy = req.query.filterBy;
  const queryData = { page, limit, sortBy, filterBy };
  try {
    const { trades, totalItems, totalPages, currentPage } =
      await tradeService.getAllTrades(queryData);
    res.status(200).json({
      message: "Trades fetched successfully.",
      data: trades,
      success: true,
      pagination: {
        totalItems,
        totalPages,
        currentPage,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAccountTrades = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const { trades } = await tradeService.getUserTrades({ userId });
    res.status(200).json({
      message: "Trades fetched successfully.",
      data: trades,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTrades,
  getTradeInfo,
  exitTrade,
  updateTrade,
  addNewTrade,
  getAccountTrades,
};
