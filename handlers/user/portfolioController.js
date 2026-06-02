const Portfolio = require("../../models/Portfolio");
const portfolioService = require("../../services/user/portfolioService");

const getUserChartData = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { timeframe } = req.params;

    const validTimeframes = ["1h", "1d", "1w", "1m", "1y", "all"];

    if (!validTimeframes.includes(timeframe.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid timeframe",
      });
    }

    const chartData = await Portfolio.getTimeframeData(
      userId,
      timeframe.toLowerCase(),
    );

    return res.status(200).json({
      success: true,
      message: "Chart data fetched successfully",
      timeframe,
      data: chartData,
      metadata: {
        startDate: chartData[0]?.x || null,
        endDate: chartData[chartData.length - 1]?.x || null,
        totalPoints: chartData.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getUserPortfolioValue = async (req, res, next) => {
  try {
    const value = await portfolioService.getCurrentPortfolioValue(userId);
    res.json({
      message: "Portoflio value fetched success",
      data: value,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const recordFundDeposit = async (req, res) => {
  try {
    const { amount, transactionId, userId } = req.body;
    const snapshot = await portfolioService.recordDeposit(
      userId,
      amount,
      transactionId,
    );
    res.json({
      message: "Deposit record success",
      data: snapshot,
      success: true,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to record deposit" });
  }
};

module.exports = { recordFundDeposit, getUserPortfolioValue, getUserChartData };
