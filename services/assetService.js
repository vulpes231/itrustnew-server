const Asset = require("../models/Asset");
const { throwError } = require("../utils/utils");

async function fetchAssets() {
	try {
		const assets = await Asset.find().lean();
		return assets;
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
