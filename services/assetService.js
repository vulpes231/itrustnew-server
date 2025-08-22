const Asset = require("../models/Asset");
const { throwError } = require("../utils/utils");

async function fetchAssets(queryData) {
	const { page, limit, sortBy, type } = queryData;
	try {
		const filter = {};
		if (type) filter["type"] = type;

		const sort = {};
		if (sortBy === "type") sort["type"] = -1;
		if (sortBy === "priceData.changePercent")
			sort["priceData.changePercent"] = -1;

		const assets = await Asset.find(filter)
			.sort(sort)
			.skip((page - 1) * limit)
			.limit(limit);

		const totalAssetCount = await Asset.countDocuments();
		const totalPages = Math.ceil(totalAssetCount / limit);
		return { assets, totalAssetCount, totalPages, currentPage: page };
	} catch (error) {
		throwError(error, "Failed to fetch assets", 500);
	}
}

async function fetchAssetById(assetId) {
	if (!assetId) throw new Error("Asset ID required!");
	try {
		const asset = await Asset.findById(assetId);
		return asset;
	} catch (error) {
		throwError(error, "Failed to fetch asset!", 500);
	}
}

async function fetchUserAssets(userId) {
	try {
		const userAssets = await Asset.find({ userId });
		return userAssets;
	} catch (error) {
		throwError(error, "Failed to fetch user assets", 500);
	}
}

module.exports = {
	fetchAssets,
	fetchAssetById,
	fetchUserAssets,
};
