const {
	buyAsset,
	sellAsset,
	fetchUserHoldings,
	fetchUserWatchlist,
	addAssetToWatchlist,
} = require("../../services/user/tradeService");

const openPosition = async (req, res) => {
	const userId = req.user.userId;
	try {
		const assetData = req.body;
		const assetName = await buyAsset(userId, assetData);
		res.status(201).json({ message: `${assetName} position opened` });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const closePosition = async (req, res) => {
	const userId = req.user.userId;
	try {
		const assetData = req.body;
		const assetName = await sellAsset(userId, assetData);
		res.status(200).json({ message: `${assetName} position closed` });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getHoldings = async (req, res) => {
	const userId = req.user.userId;
	try {
		const holdings = await fetchUserHoldings(userId);
		res
			.status(200)
			.json({ message: "Holdings fetched successfully", holdings });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const addToWatchlist = async (req, res) => {
	const userId = req.user.userId;
	try {
		const assetData = req.body;
		await addAssetToWatchlist(userId, assetData);
		res.status(200).json({ message: "Watchlist updated" });
	} catch (error) {
		res.status(500).json({ message: error.message });
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
		res.status(500).json({ message: error.message });
	}
};

module.exports = {
	openPosition,
	closePosition,
	getHoldings,
	addToWatchlist,
	getWatchlist,
};
