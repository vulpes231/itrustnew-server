const Watchlist = require("../../models/Watchlist");
const { CustomError } = require("../../utils/utils");
const { fetchAssetById } = require("../assetService");

async function addAssetToWatchlist(userId, assetId) {
	if (!assetId) throw new CustomError("Asset ID required!", 400);
	try {
		const asset = await fetchAssetById(assetId);
		if (!asset) throw new CustomError("Asset not found!", 404);

		const userWatchlist = await fetchUserWatchlist(userId);

		const assetExists = userWatchlist.some((item) => item.assetId === assetId);
		if (assetExists) throw new CustomError("Asset already on watchlist!", 409);

		const watchListItem = await Watchlist.create({
			userId: userId,
			name: asset.name,
			symbol: asset.symbol,
			img: asset.imageUrl,
			price: asset.priceData.current,
			type: asset.type,
			assetId: asset._id,
		});

		return watchListItem;
	} catch (error) {
		throw new CustomError("Failed to add asset to user watchlist!", 500);
	}
}

async function removeAssetFromWatchlist(userId, assetId) {
	if (!assetId) throw new CustomError("Asset ID required!", 400);
	try {
		// Option 1: If using Mongoose model directly
		const result = await Watchlist.deleteOne({
			userId: userId,
			assetId: assetId,
		});

		if (result.deletedCount === 0) {
			throw new CustomError("Asset not on watchlist!", {
				statusCode: 400,
			});
		}

		return true;
	} catch (error) {
		throw new CustomError("Failed to remove asset from user watchlist!", 500);
	}
}

async function fetchUserWatchlist(userId) {
	if (!userId) throw new CustomError("User ID required!", 400);
	try {
		const userWatchlist = await Watchlist.find({ userId }).lean();
		return userWatchlist;
	} catch (error) {
		throw new CustomError(`Error fetching watchlist for user ${userId}!`, 500);
	}
}

module.exports = {
	addAssetToWatchlist,
	fetchUserWatchlist,
	removeAssetFromWatchlist,
};
