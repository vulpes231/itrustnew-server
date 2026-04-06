const portFolioTracker = require("../../services/user/chartService");

const getUserChart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    if (!userId)
      return res.status(401).json({ message: "Unauthorized!", success: false });
    const chartData = await portFolioTracker.getUserChartData(userId);
    res.status(200).json({
      data: chartData,
      message: "User chart fetched successfully",
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUserChart };
