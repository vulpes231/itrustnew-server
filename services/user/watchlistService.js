const User = require("../../models/User");
const Asset = require("../../models/Asset");

/**
 * Get user's watchlist with fully populated asset data
 * @param {string} userId - User's ObjectId
 * @returns {Promise<Array>} - Array of assets with full details
 */
async function getWatchlist(userId) {
  try {
    const user = await User.findById(userId)
      .populate({
        path: "watchList.assetId",
        select:
          "symbol name type exchange priceData historical fundamentals imageUrl isActive isTradable lastUpdated",
      })
      .lean();

    if (!user) {
      throw new Error("User not found");
    }

    const watchlist = user.watchList
      .filter((item) => item.assetId !== null)
      .map((item) => ({
        id: item.assetId._id,
        symbol: item.assetId.symbol,
        name: item.assetId.name,
        type: item.assetId.type,
        exchange: item.assetId.exchange,
        priceData: {
          current: item.assetId.priceData?.current || 0,
          open: item.assetId.priceData?.open,
          previousClose: item.assetId.priceData?.previousClose,
          dayLow: item.assetId.priceData?.dayLow,
          dayHigh: item.assetId.priceData?.dayHigh,
          change: item.assetId.priceData?.change,
          changePercent: item.assetId.priceData?.changePercent,
          volume: item.assetId.priceData?.volume,
          avgVolume: item.assetId.priceData?.avgVolume,
        },
        historical: {
          yearLow: item.assetId.historical?.yearLow,
          yearHigh: item.assetId.historical?.yearHigh,
        },
        fundamentals: {
          marketCap: item.assetId.fundamentals?.marketCap,
          eps: item.assetId.fundamentals?.eps,
          pe: item.assetId.fundamentals?.pe,
          dividendYield: item.assetId.fundamentals?.dividendYield,
        },
        imageUrl: item.assetId.imageUrl,
        isActive: item.assetId.isActive,
        isTradable: item.assetId.isTradable,
        lastUpdated: item.assetId.lastUpdated,
      }));

    return watchlist;
  } catch (error) {
    console.error("Error getting watchlist:", error);
    throw error;
  }
}

/**
 * Add asset to user's watchlist
 * @param {string} userId - User's ObjectId
 * @param {string} assetId - Asset's ObjectId
 * @returns {Promise<Object>} - Updated user
 */
async function addToWatchlist(userId, assetId) {
  try {
    const asset = await Asset.findById(assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }

    const user = await User.findById(userId);
    const alreadyExists = user.watchList.some(
      (item) => item.assetId.toString() === assetId,
    );

    if (alreadyExists) {
      throw new Error("Asset already in watchlist");
    }

    user.watchList.push({ assetId });
    await user.save();

    return await getWatchlist(userId);
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    throw error;
  }
}

/**
 * Remove asset from user's watchlist
 * @param {string} userId - User's ObjectId
 * @param {string} assetId - Asset's ObjectId
 * @returns {Promise<Object>} - Updated user
 */
async function removeFromWatchlist(userId, assetId) {
  try {
    const user = await User.findById(userId);

    user.watchList = user.watchList.filter(
      (item) => item.assetId.toString() !== assetId,
    );

    await user.save();

    return await getWatchlist(userId);
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    throw error;
  }
}

/**
 * Check if asset is in user's watchlist
 * @param {string} userId - User's ObjectId
 * @param {string} assetId - Asset's ObjectId
 * @returns {Promise<boolean>}
 */
async function isInWatchlist(userId, assetId) {
  try {
    const user = await User.findById(userId);
    return user.watchList.some((item) => item.assetId.toString() === assetId);
  } catch (error) {
    console.error("Error checking watchlist:", error);
    return false;
  }
}

/**
 * Get watchlist with only essential data (lighter response)
 * @param {string} userId - User's ObjectId
 * @returns {Promise<Array>} - Simplified watchlist data
 */
async function getWatchlistSimple(userId) {
  try {
    const user = await User.findById(userId)
      .populate({
        path: "watchList.assetId",
        select:
          "symbol name type priceData.current priceData.change priceData.changePercent imageUrl",
      })
      .lean();

    if (!user) {
      throw new Error("User not found");
    }

    return user.watchList
      .filter((item) => item.assetId !== null)
      .map((item) => ({
        id: item.assetId._id,
        symbol: item.assetId.symbol,
        name: item.assetId.name,
        type: item.assetId.type,
        currentPrice: item.assetId.priceData?.current || 0,
        change: item.assetId.priceData?.change || 0,
        changePercent: item.assetId.priceData?.changePercent || 0,
        imageUrl: item.assetId.imageUrl,
      }));
  } catch (error) {
    console.error("Error getting simple watchlist:", error);
    throw error;
  }
}

module.exports = {
  getWatchlist,
  getWatchlistSimple,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
};
