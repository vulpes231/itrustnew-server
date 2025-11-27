const Trade = require("../../models/Trade");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const { fetchAssetById } = require("../assetService");
const { fetchPlanById } = require("./autoPlanService");

async function buyAsset(userId, assetData) {
  if (!userId) throw new CustomError("Bad credentials!", 400);
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
    throw new CustomError("Bad request!", 400);
  try {
    const asset = await fetchAssetById(assetId);
    if (!asset) throw new CustomError("Asset not found!", 404);

    const userWallet = await Wallet.findById(walletId);
    if (!userWallet) throw new CustomError("Wallet not found!", 404);

    const parsedAmount = parseFloat(amount);
    const qty = parseFloat(parsedAmount / asset.priceData.current).toFixed(6);

    if (userWallet.availableBalance <= parsedAmount)
      throw new CustomError("Insufficient funds!", 400);

    let plan;

    if (planId) {
      plan = await fetchPlanById(planId);
    }

    userWallet.availableBalance -= parsedAmount;
    await userWallet.save();

    const tradeData = {
      userId: userId,
      asset: {
        assetId: asset._id,
        name: asset.name,
        symbol: asset.symbol,
        img: asset.imageUrl,
      },
      planId: plan?._id || null,
      assetType: asset.type,
      orderType: orderType,
      wallet: {
        id: userWallet._id,
        name: userWallet.name,
      },
      execution: {
        price: asset.priceData.current,
        quantity: qty,
        amount: parsedAmount,
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
    console.log(error.message);
    throw new CustomError(error.message, 500);
  }
}

async function sellAsset(userId, tradeId) {
  if (!userId) throw new CustomError("Bad credentials!", 400);
  if (!tradeId) throw new CustomError("Bad request!", 400);
  try {
    const trade = await Trade.findById(tradeId);
    if (!trade) throw new CustomError("Trade not found!", 404);

    const userWallet = await Wallet.findById(trade.wallet.id);
    if (!trade) throw new CustomError("Wallet not found!", 404);

    userWallet.availableBalance += trade.performance.totalReturn;
    await userWallet.save();

    trade.status = "closed";
    await trade.save();

    return trade;
  } catch (error) {
    throw new CustomError("Failed to close position!", 500);
  }
}

async function fetchUserTrades(userId, queryData) {
  const { page = 1, limit = 15, sortBy, status } = queryData;

  if (!userId) throw new CustomError("User ID is required", 400);
  if (status && !["open", "closed"].includes(status)) {
    throw new CustomError("Invalid status. Use 'open' or 'closed'.", {
      statusCode: 422,
    });
  }

  try {
    const filter = { userId };
    if (status) filter.status = status;

    const sort = {};
    if (sortBy === "createdAt") sort.createdAt = -1;
    if (sortBy === "status") sort.status = 1;

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
    throw new CustomError(error.message, error.statusCode);
  }
}

async function getTradedata(userId) {
  try {
    const trades = await Trade.find({ userId });

    const buyTrades = trades.filter((trade) => trade.orderType === "buy");
    const sellTrades = trades.filter((trade) => trade.orderType === "sell");

    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();

    const todayBuys = trades.filter(
      (trade) => trade.createdAt >= startOfToday && trade.orderType === "buy"
    );
    const todaySells = trades.filter(
      (trade) => trade.createdAt >= startOfToday && trade.orderType === "sell"
    );

    const totalBuys = buyTrades.reduce((sum, trade) => {
      return sum + trade.execution.amount;
    }, 0);

    const totalSells = sellTrades.reduce((sum, trade) => {
      return sum + trade.execution.amount;
    }, 0);

    const totalBuysToday = todayBuys.reduce((sum, trade) => {
      return sum + trade.execution.amount;
    }, 0);

    const totalSellsToday = todaySells.reduce((sum, trade) => {
      return sum + trade.execution.amount;
    }, 0);

    const tradeInsight = {
      totalBuys,
      totalSells,
      totalBuysToday,
      totalSellsToday,
    };

    return tradeInsight;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

module.exports = {
  buyAsset,
  sellAsset,
  fetchUserTrades,
  getTradedata,
};
