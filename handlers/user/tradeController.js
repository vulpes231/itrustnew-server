const {
  buyAsset,
  sellAsset,
  fetchUserTrades,
  getTradedata,
} = require("../../services/user/tradeService");

const openPosition = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const assetData = req.body;
    const { assetName, assetQty } = await buyAsset(userId, assetData);
    res.status(201).json({
      message: `${assetName} position opened`,
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const closePosition = async (req, res, next) => {
  const userId = req.user.userId;
  const { tradeId } = req.body;
  try {
    const trade = await sellAsset(userId, tradeId);
    res.status(200).json({
      message: `${trade.asset.name} position closed succesfully`,
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const getUserTrades = async (req, res, next) => {
  const userId = req.user.userId;
  const limit = Math.min(50, parseInt(req.query.limit) || 15);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const sortBy = req.query.sortBy;
  const status = req.query.status?.toLowerCase();

  try {
    const { filteredTrades, totalResultCount, totalPageCount, currentPage } =
      await fetchUserTrades(userId, { page, limit, sortBy, status });

    res.status(200).json({
      message: "Trades fetched successfully",
      success: true,
      data: filteredTrades,
      pagination: {
        currentPage,
        totalResult: totalResultCount,
        totalPages: totalPageCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getTradeInsight = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const tradeInsight = await getTradedata(userId);

    res.status(200).json({
      message: "Trades insight fetched successfully",
      success: true,
      data: tradeInsight,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  openPosition,
  closePosition,
  getUserTrades,
  getTradeInsight,
};
