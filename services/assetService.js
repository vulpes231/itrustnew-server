const Asset = require("../models/Asset");
const { CustomError } = require("../utils/utils");

async function fetchAssets(queryData) {
	const { page, limit, sortBy, type } = queryData;
	try {
		const filter = {};
		if (type) filter["type"] = type;

		const sort = {};

		if (sortBy === "priceData.changePercent") {
			sort["priceData.changePercent"] = -1; // Highest gainers first
			console.log("Sorting by: priceData.changePercent (descending)");
		} else if (sortBy === "priceData.volume") {
			sort["priceData.volume"] = -1; // Highest volume first
			console.log("Sorting by: priceData.volume (descending)");
		} else if (sortBy === "marketCap") {
			sort["marketCap"] = -1; // Highest market cap first
			console.log("Sorting by: marketCap (descending)");
		} else if (sortBy === "name") {
			sort["name"] = 1; // Alphabetical
			console.log("Sorting by: name (ascending)");
		} else {
			// Default fallback
			sort["priceData.volume"] = -1; // Default to most popular
			console.log("Using default sort: priceData.volume (descending)");
		}

		const assets = await Asset.find(filter)
			.sort(sort)
			.skip((page - 1) * limit)
			.limit(limit);

		const totalAssetCount = await Asset.countDocuments();
		const totalPages = Math.ceil(totalAssetCount / limit);
		return { assets, totalAssetCount, totalPages, currentPage: page };
	} catch (error) {
		throw new CustomError("Failed to fetch assets", 500);
	}
}
async function fetchAssetById(assetId) {
	if (!assetId) throw new CustomError("Asset ID required!", 400);
	try {
		const asset = await Asset.findById(assetId);
		return asset;
	} catch (error) {
		throw new CustomError("Failed to fetch asset!", 500);
	}
}

async function fetchUserAssets(userId) {
	try {
		const userAssets = await Asset.find({ userId });
		return userAssets;
	} catch (error) {
		throw new CustomError("Failed to fetch user assets", 500);
	}
}

async function searchAssets(queryData) {
	const { query } = queryData;
	if (!query || query.length < 2) {
		throw new CustomError("Invalid search term!", 400);
	}
	try {
		const assets = await Asset.find({
			$or: [
				{ name: { $regex: query, $options: "i" } },
				{ symbol: { $regex: query, $options: "i" } },
			],
		})
			.select("name symbol type priceData.current _id")
			.lean();
		return assets;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

module.exports = {
	fetchAssets,
	fetchAssetById,
	fetchUserAssets,
	searchAssets,
};
