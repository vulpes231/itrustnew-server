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
		res
			.status(200)
			.json({ message: "Asset added to watchlist", data: null, success: true });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const removeFromWatchlist = async (req, res) => {
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
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getWatchlist = async (req, res) => {
	const userId = req.user.userId;
	try {
		const watchlist = await fetchUserWatchlist(userId);
		res.status(200).json({
			message: "Watchlist fetched successfully",
			data: watchlist,
			success: true,
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

module.exports = { addToWatchlist, getWatchlist, removeFromWatchlist };
