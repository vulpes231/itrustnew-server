const Asset = require("../../models/Asset");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");

async function createTrade(tradeData) {
	const {
		userId,
		assetId,
		planId,
		orderType,
		walletId,
		amount,
		leverage,
		sl,
		tp,
		entry,
		exit,
		interval,
	} = tradeData;

	if (!userId || !assetId || !walletId || !amount || !orderType) {
		throw new CustomError("Fill in the required field!", 400);
	}

	try {
		const parsedAmt = parseFloat(amount);

		const user = await User.findById(userId);
		if (!user) {
			throw new CustomError("Invalid request!", 404);
		}

		const wallet = await Wallet.findById(walletId);
		if (!wallet) {
			throw new CustomError("Invalid wallet!", 404);
		}

		const asset = await Asset.findById(assetId);
		if (!asset) {
			throw new CustomError("Asset not found!", 404);
		}

		const qty = parsedAmt / asset.priceData.current;

		const initialCurrentValue = parsedAmt;

		const newTrade = {
			userId: userId,
			asset: {
				assetId: asset._id,
				name: asset.name,
				symbol: asset.symbol,
				img: asset.imageUrl,
			},
			planId: planId || null,
			assetType: asset.type,
			orderType: orderType,
			wallet: {
				id: wallet._id,
				name: wallet.name,
			},
			execution: {
				price: asset.priceData.current,
				quantity: qty,
				amount: parsedAmt,
				leverage: leverage || 1,
				interval: interval || null,
			},
			targets: {
				takeProfit: tp || null,
				stopLoss: sl || null,
				entryPoint: entry || null,
				exitPoint: exit || null,
			},
			performance: {
				currentValue: initialCurrentValue,
				profitLoss: 0,
				profitLossPercentage: 0,
			},
			status: "open",
		};

		if (wallet.availableBalance < parsedAmt) {
			throw new CustomError("Insufficient funds!", 400);
		}

		wallet.availableBalance -= parsedAmt;
		await wallet.save();

		const createdTrade = await Trade.create(newTrade);
		return createdTrade;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function closeTrade(tradeId) {
	if (!tradeId) {
		throw new CustomError("Invalid trade!", 400);
	}
	try {
		const trade = await Trade.findById(tradeId);
		if (!trade) {
			throw new CustomError("Invalid trade!", 404);
		}

		if (trade.status === "closed") {
			throw new CustomError("Trade is already closed!", 400);
		}

		const wallet = await Wallet.findById(trade.wallet.id);
		if (!wallet) {
			throw new CustomError("Invalid wallet!", 404);
		}

		const asset = await Asset.findById(trade.asset.assetId);
		if (!asset) {
			throw new CustomError("Asset not found!", 404);
		}

		const currentPrice = asset.priceData.current;
		const entryPrice = trade.execution.price;
		const quantity = trade.execution.quantity;
		const leverage = trade.execution.leverage || 1;
		const initialAmount = trade.execution.amount;
		const extraBonus = trade.extra || 0;

		let finalValue, profitLoss;

		if (trade.orderType === "buy") {
			finalValue = quantity * currentPrice * leverage;
			profitLoss = finalValue - initialAmount;
		} else if (trade.orderType === "sell") {
			finalValue = initialAmount - quantity * currentPrice * leverage;
			profitLoss = finalValue - initialAmount;
		} else {
			// For spot trades
			finalValue = quantity * currentPrice;
			profitLoss = finalValue - initialAmount;
		}

		const totalFinalValue = finalValue + extraBonus;
		const totalProfitLoss = profitLoss + extraBonus;

		wallet.availableBalance += totalFinalValue;
		wallet.totalBalance += totalProfitLoss;

		await wallet.save();

		trade.performance.currentValue = totalFinalValue;
		trade.performance.profitLoss = totalProfitLoss;
		trade.performance.profitLossPercentage =
			(totalProfitLoss / initialAmount) * 100;

		trade.targets.exitPoint = currentPrice;
		trade.status = "closed";
		trade.closedAt = new Date();
		trade.closeReason = "manual_close";

		await trade.save();
		return trade;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function updateTradePerformance(tradeId) {
	try {
		const trade = await Trade.findById(tradeId);
		if (!trade || trade.status !== "open")
			throw new CustomError("Cannot update closed trade!", 400);

		const asset = await Asset.findById(trade.asset.assetId);
		if (!asset) return null;

		const currentPrice = asset.priceData.current;
		const entryPrice = trade.execution.price;
		const quantity = trade.execution.quantity;
		const leverage = trade.execution.leverage || 1;
		const extraBonus = trade.extra || 0;

		let currentValue, profitLoss, profitLossPercentage;

		if (trade.orderType === "buy") {
			currentValue = quantity * currentPrice * leverage;
			profitLoss = currentValue - trade.execution.amount;
			profitLossPercentage = (profitLoss / trade.execution.amount) * 100;
		} else if (trade.orderType === "sell") {
			currentValue =
				trade.execution.amount - quantity * currentPrice * leverage;
			profitLoss = currentValue - trade.execution.amount;
			profitLossPercentage = (profitLoss / trade.execution.amount) * 100;
		} else {
			currentValue = quantity * currentPrice;
			profitLoss = currentValue - trade.execution.amount;
			profitLossPercentage = (profitLoss / trade.execution.amount) * 100;
		}

		const totalCurrentValue = currentValue + extraBonus;
		const totalProfitLoss = profitLoss + extraBonus;
		const totalProfitLossPercentage =
			(totalProfitLoss / trade.execution.amount) * 100;

		trade.performance.currentValue = totalCurrentValue;
		trade.performance.profitLoss = totalProfitLoss;
		trade.performance.profitLossPercentage = totalProfitLossPercentage;
		trade.performance.extraBonus = extraBonus;

		if (
			trade.targets.takeProfit &&
			profitLossPercentage >= trade.targets.takeProfit
		) {
			trade.status = "closed";
			trade.closedAt = new Date();
			trade.closeReason = "take_profit";
		} else if (
			trade.targets.stopLoss &&
			profitLossPercentage <= trade.targets.stopLoss
		) {
			trade.status = "closed";
			trade.closedAt = new Date();
			trade.closeReason = "stop_loss";
		}

		await trade.save();
		return trade;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function editTradeData(tradeData) {
	const { extra, leverage, sl, tp, tradeId } = tradeData;
	if (!tradeId) {
		throw new CustomError("Invalid trade!", 400);
	}
	try {
		const trade = await Trade.findById(tradeId);
		if (!trade || trade.status !== "open")
			throw new CustomError("Cannot update closed trade!", 400);

		if (extra) trade.extra = extra;
		if (leverage) trade.execution.leverage = leverage;
		if (sl) trade.targets.stopLoss = sl;
		if (tp) trade.targets.takeProfit = tp;

		await trade.save();

		await updateTradePerformance(tradeId);

		return trade;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function fetchAllTrades(queryData) {
	const { sortBy, filterBy, limit, page } = queryData;
	try {
		const sort = {};
		if (sortBy) sort[sortBy] = -1;

		const trades = await Trade.find()
			.sort(sort)
			.skip(page - 1, limit)
			.limit(limit);

		const totalItems = await Trade.countDocuments();
		const totalPages = Math.ceil(totalItems / limit);

		return { trades, totalItems, totalPages, currentPage: page };
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function getTradeById(tradeId) {
	if (!tradeId) {
		throw new CustomError("Invalid trade!", 400);
	}
	try {
		const trade = await Trade.findById(tradeId).lean();
		if (!trade) throw new CustomError("Trade not found!", 404);

		return trade;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function deleteTrade(tradeId) {
	if (!tradeId) {
		throw new CustomError("Invalid trade!", 400);
	}
	try {
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

module.exports = {
	createTrade,
	editTradeData,
	// deleteTrade,
	closeTrade,
	updateTradePerformance,
	fetchAllTrades,
	getTradeById,
};
