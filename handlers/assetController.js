const {
	fetchAssets,
	fetchAssetById,
	fetchUserAssets,
} = require("../services/assetService");

const getAssets = async (req, res) => {
	try {
		const assets = await fetchAssets();
		res.status(200).json({
			data: assets,
			success: true,
			message: "Assets fetched successfully",
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getAssetInfo = async (req, res) => {
	const { assetId } = req.params;
	try {
		const asset = await fetchAssetById(assetId);
		res.status(200).json({
			data: asset,
			success: true,
			message: "Asset fetched successfully",
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getUserAssets = async (req, res) => {
	const userId = req.user.userId;
	try {
		const asset = await fetchUserAssets(userId);
		res
			.status(200)
			.json({
				data: asset,
				success: true,
				message: "User assets fetched successfully",
			});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

module.exports = { getUserAssets, getAssetInfo, getAssets };
