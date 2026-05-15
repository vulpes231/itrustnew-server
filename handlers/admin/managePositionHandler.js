const User = require("../../models/User");
const managePositionService = require("../../services/admin/managePositionService");
const tradeService = require("../../services/admin/manageTradeService");
const queueService = require("../../services/queueService");

const getAllPositions = async (req, res, next) => {
  try {
    const positions = await managePositionService.fetchAllPositions();
    // console.log(positions);
    res
      .status(200)
      .json({ message: "fetched positions", data: positions, success: true });
  } catch (error) {
    next(error);
  }
};

const getPositionInfo = async (req, res, next) => {
  try {
    const positions = await managePositionService.fetchAllPositions();
    // console.log(positions);
    res
      .status(200)
      .json({ message: "fetched positions", data: positions, success: true });
  } catch (error) {
    next(error);
  }
};

const exitTrade = async (req, res, next) => {
  const { positionId } = req.params;
  const { amount, notifyUser, userId } = req.body;
  console.log("processing");

  try {
    const result = await tradeService.closePosition({
      positionId,
      amount,
    });

    if (result.success && notifyUser) {
      const user = await User.findById(userId).lean();
      if (!user) {
        throw new Error("User not found!", 400);
      }

      const userEmail = user.contactInfo.email;
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

module.exports = { getAllPositions, exitTrade, getPositionInfo };
