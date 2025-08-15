const Asset = require("../models/Asset");

async function fetchAssets() {
	try {
		const assets = await Asset.find();
		return assets;
	} catch (error) {
		throw new Error("Failed to fetch assets");
	}
}

async function fetchAssetById(assetId) {
	if (!assetId) throw new Error("Asset ID required!");
	try {
		const asset = await Asset.findById(assetId);
		return asset;
	} catch (error) {
		throw new Error("Failed to fetch asset!");
	}
}

async function fetchUserAssets(userId) {
	try {
		const userAssets = await Asset.find({ userId });
		return userAssets;
	} catch (error) {
		throw new Error("Failed to fetch user assets");
	}
}

module.exports = {
	fetchAssets,
	fetchAssetById,
	fetchUserAssets,
};
