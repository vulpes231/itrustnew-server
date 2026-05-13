const Portfolio = require("../../models/Portfolio");
const portfolioService = require("../../services/user/portfolioService");

const getUserChartData = async (req, res, next) => {
  try {
    const { timeframe } = req.params;
    const validTimeframes = ["1h", "1d", "1w", "1m", "1y", "all"];

    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({ error: "Invalid timeframe" });
    }

    let chartData;
    if (timeframe === "all") {
      const snapshots = await Portfolio.find({
        userId: req.userId,
      }).sort({ timestamp: 1 });

      chartData = snapshots.map((s) => ({
        x: s.timestamp,
        y: s.portfolioValue,
        reason: s.reason,
      }));
    } else {
      chartData = await portfolioService.getChartData(req.userId, timeframe);
    }

    res.json({
      timeframe,
      data: chartData,
      metadata: {
        startDate: chartData[0]?.x,
        endDate: chartData[chartData.length - 1]?.x,
        totalPoints: chartData.length,
      },
      success: true,
      message: "chart data fecthed succesfully",
    });
  } catch (error) {
    next(error);
  }
};

const getUserPortfolioValue = async (req, res, next) => {
  try {
    const value = await portfolioService.getCurrentPortfolioValue(req.userId);
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
