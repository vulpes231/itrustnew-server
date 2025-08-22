const {
	addAssetToWatchlist,
	fetchUserWatchlist,
	removeAssetFromWatchlist,
} = require("../../services/user/watchlistService");

const addToWatchlist = async (req, res) => {
	const userId = req.user.userId;
	const { assetId } = req.body;
	try {
		await addAssetToWatchlist(userId, assetId);
		res.status(200).json({ message: "Asset added to watchlist" });
	} catch (error) {
		const statusCode = error.statusCode;
		res.status(statusCode).json({ message: error.message });
	}
};

const removeFromWatchlist = async (req, res) => {
	const userId = req.user.userId;
	const { assetId } = req.body;
	try {
		await removeAssetFromWatchlist(userId, assetId);
		res.status(200).json({ message: "Asset removed from watchlist" });
	} catch (error) {
		const statusCode = error.statusCode;
		res.status(statusCode).json({ message: error.message });
	}
};

const getWatchlist = async (req, res) => {
	const userId = req.user.userId;
	try {
		const watchlist = await fetchUserWatchlist(userId);
		res
			.status(200)
			.json({ message: "Watchlist fetched successfully", watchlist });
	} catch (error) {
		const statusCode = error.statusCode;
		res.status(statusCode).json({ message: error.message });
	}
};

module.exports = { addToWatchlist, getWatchlist, removeFromWatchlist };
