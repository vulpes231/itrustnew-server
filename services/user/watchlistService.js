const Watchlist = require("../../models/Watchlist");
const { fetchAssetById } = require("../assetService");

async function addAssetToWatchlist(userId, assetId) {
	if (!assetId) throw new Error("Asset ID required!");
	try {
		const asset = await fetchAssetById(assetId);
		if (!asset) throw new Error("Asset not found!");

		const userWatchlist = await fetchUserWatchlist(userId);

		const assetExists = userWatchlist.some((item) => item.assetId === assetId);
		if (assetExists) throw new Error("Asset already on watchlist!");

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
		console.log(error.message);
		throw new Error("Failed to add asset to user watchlist!");
	}
}

async function removeAssetFromWatchlist(userId, assetId) {
	if (!assetId) throw new Error("Asset ID required!");
	try {
		// Option 1: If using Mongoose model directly
		const result = await Watchlist.deleteOne({
			userId: userId,
			assetId: assetId,
		});

		if (result.deletedCount === 0) {
			throw new Error("Asset not on watchlist!");
		}

		return true;
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to remove asset from user watchlist!");
	}
}

async function fetchUserWatchlist(userId) {
	if (!userId) throw new Error("User ID required!");
	try {
		const userWatchlist = await Watchlist.find({ userId }).lean();
		return userWatchlist;
	} catch (error) {
		console.error(
			`Error fetching watchlist for user ${userId}:`,
			error.message
		);
		throw new Error("Failed to fetch user watchlist");
	}
}

module.exports = {
	addAssetToWatchlist,
	fetchUserWatchlist,
	removeAssetFromWatchlist,
};
