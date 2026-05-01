const watchListService = require("../../services/user/watchlistService");

const addAssetToWatchlist = async (req, res, next) => {
  const userId = req.user.userId;
  const { assetId } = req.body;
  try {
    const watclist = await watchListService.addToWatchlist(userId, assetId);
    res.status(200).json({
      message: "Asset added to watchlist",
      data: watclist,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const removeAssetFromWatchlist = async (req, res, next) => {
  const userId = req.user.userId;
  const { assetId } = req.body;
  try {
    const watchlist = await watchListService.removeFromWatchlist(
      userId,
      assetId,
    );
    res.status(200).json({
      message: "Asset removed from watchlist",
      data: watchlist,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getUserWatchlist = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const watchlist = await watchListService.getWatchlist(userId);
    res.status(200).json({
      message: "Watchlist fetched successfully",
      data: watchlist,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const checkWatchlist = async (req, res, next) => {
  const userId = req.user.userId;
  const assetId = req.params.assetId;
  try {
    const itemExists = await watchListService.isInWatchlist(userId, assetId);
    res.status(200).json({
      message: "Watchlist fetched successfully",
      data: itemExists,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addAssetToWatchlist,
  getUserWatchlist,
  removeAssetFromWatchlist,
  checkWatchlist,
};
