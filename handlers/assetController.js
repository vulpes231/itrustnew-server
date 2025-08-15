const {
	fetchAssets,
	fetchAssetById,
	fetchUserAssets,
} = require("../services/assetService");

const getAssets = async (req, res) => {
	try {
		const assets = await fetchAssets();
		res.status(200).json({ assets });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getAssetInfo = async (req, res) => {
	const { assetId } = req.params;
	try {
		const asset = await fetchAssetById(assetId);
		res.status(200).json({ asset });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getUserAssets = async (req, res) => {
	const userId = req.user.userId;
	try {
		const asset = await fetchUserAssets(userId);
		res.status(200).json({ asset });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

module.exports = { getUserAssets, getAssetInfo, getAssets };
