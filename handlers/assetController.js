const {
	fetchAssets,
	fetchAssetById,
	fetchUserAssets,
} = require("../services/assetService");

const getAssets = async (req, res, next) => {
	const page = Math.max(1, parseInt(req.query.page, 10) || 1);
	const limit = Math.min(50, parseInt(req.query.limit, 10) || 15);
	const sortBy = req.query.sortBy;

	const type = req.query.type;
	try {
		const { assets, totalAssetCount, totalPages, currentPage } =
			await fetchAssets({ page, limit, sortBy, type });
		res.status(200).json({
			data: assets,
			success: true,
			message: "Assets fetched successfully",
			pagination: {
				currentPage,
				totalAssets: totalAssetCount,
				totalPages,
			},
		});
	} catch (error) {
		next(error);
	}
};

const getAssetInfo = async (req, res, next) => {
	const { assetId } = req.params;
	try {
		const asset = await fetchAssetById(assetId);
		res.status(200).json({
			data: asset,
			success: true,
			message: "Asset fetched successfully",
		});
	} catch (error) {
		next(error);
	}
};

const getUserAssets = async (req, res, next) => {
	const userId = req.user.userId;
	try {
		const asset = await fetchUserAssets(userId);
		res.status(200).json({
			data: asset,
			success: true,
			message: "User assets fetched successfully",
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { getUserAssets, getAssetInfo, getAssets };
