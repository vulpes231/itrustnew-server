const Trade = require("../../models/Trade");
const Wallet = require("../../models/Wallet");
const { throwError } = require("../../utils/utils");
const { fetchAssetById } = require("../assetService");
const { fetchPlanById } = require("./autoPlanService");

async function buyAsset(userId, assetData) {
	if (userId) throw new Error("Bad credentials!", { statusCode: 401 });
	const {
		assetId,
		planId,
		orderType,
		walletId,
		amount,
		leverage,
		interval,
		tp,
		sl,
		entry,
		exit,
	} = assetData;
	if (!assetId || !orderType || !walletId || !amount)
		throw new Error("Bad request!", { statusCode: 400 });
	try {
		const asset = await fetchAssetById(assetId);
		if (!asset) throw new Error("Asset not found!", { statusCode: 404 });

		const userWallet = await Wallet.findById(walletId);
		if (!userWallet) throw new Error("Wallet not found!", { statusCode: 404 });

		const parsedAmount = parseFloat(amount);
		const qty = parseFloat(asset.priceData.current * parsedAmount).toFixed(4);

		if (userWallet.availableBalance <= parsedAmount)
			throw new Error("Insufficient funds!", { statusCode: 400 });

		let plan;

		if (planId) {
			plan = await fetchPlanById(planId);
		}

		const tradeData = {
			userId: userId,
			asset: {
				assetId: asset._id,
				name: asset.name,
				symbol: asset.symbol,
				img: asset.imageUrl,
			},
			planId: plan._id || null,
			assetType: asset.type,
			orderType: orderType,
			wallet: {
				id: userWallet._id,
				name: userWallet.name,
			},
			execution: {
				price: asset.priceData.current,
				quantity: qty,
				amount: leverage || null,
				interval: interval || null,
			},
			targets: {
				takeProfit: tp || null,
				stopLoss: sl || null,
				entryPoint: entry || null,
				exitPoint: exit || null,
			},
		};

		const trade = await Trade.create(tradeData);
		const assetName = trade.asset.name;
		const assetQty = trade.execution.quantity;
		return { assetName, assetQty };
	} catch (error) {
		throwError(error, "Failed to open position!", 500);
	}
}

async function sellAsset(userId, tradeId) {
	if (userId) throw new Error("Bad credentials!", { statusCode: 401 });
	if (!tradeId) throw new Error("Bad request!", { statusCode: 400 });
	try {
		const trade = await Trade.findById(tradeId);
		if (!trade) throw new Error("Trade not found!", { statusCode: 404 });

		const userWallet = await Wallet.findById(trade.wallet.id);
		if (!trade) throw new Error("Wallet not found!", { statusCode: 404 });

		userWallet.availableBalance += trade.performance.totalReturn;
		await userWallet.save();

		trade.status = "closed";
		await trade.save();

		return trade;
	} catch (error) {
		throwError(error, "Failed to close position!", 500);
	}
}

async function fetchUserTrades(userId, queryData) {
	const { page = 1, limit = 15, sortBy, status } = queryData;

	// Validate input
	if (!userId) throw new Error("User ID is required", { statusCode: 400 });
	if (status && !["open", "closed"].includes(status)) {
		throw new Error("Invalid status. Use 'open' or 'closed'.", {
			statusCode: 422,
		});
	}

	try {
		// Build query
		const filter = { userId };
		if (status) filter.status = status;

		// Build sort
		const sort = {};
		if (sortBy === "createdAt") sort.createdAt = -1;
		if (sortBy === "status") sort.status = 1;

		// Fetch paginated trades
		const filteredTrades = await Trade.find(filter)
			.sort(sort)
			.skip((page - 1) * limit)
			.limit(limit);

		const totalResultCount = await Trade.countDocuments(filter);
		const totalPageCount = Math.ceil(totalResultCount / limit);

		return {
			filteredTrades,
			totalResultCount,
			totalPageCount,
			currentPage: page,
		};
	} catch (error) {
		throwError(error, "Failed to fetch trades", 500);
	}
}

module.exports = {
	buyAsset,
	sellAsset,
	fetchUserTrades,
};
