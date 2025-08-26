const {
	addAssetToWatchlist,
	fetchUserWatchlist,
	removeAssetFromWatchlist,
} = require("../../services/user/watchlistService");

const addToWatchlist = async (req, res, next) => {
	const userId = req.user.userId;
	const { assetId } = req.body;
	try {
		await addAssetToWatchlist(userId, assetId);
		res
			.status(200)
			.json({ message: "Asset added to watchlist", data: null, success: true });
	} catch (error) {
		next(error);
	}
};

const removeFromWatchlist = async (req, res, next) => {
	const userId = req.user.userId;
	const { assetId } = req.body;
	try {
		await removeAssetFromWatchlist(userId, assetId);
		res.status(200).json({
			message: "Asset removed from watchlist",
			data: null,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

const getWatchlist = async (req, res, next) => {
	const userId = req.user.userId;
	try {
		const watchlist = await fetchUserWatchlist(userId);
		res.status(200).json({
			message: "Watchlist fetched successfully",
			data: watchlist,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { addToWatchlist, getWatchlist, removeFromWatchlist };
