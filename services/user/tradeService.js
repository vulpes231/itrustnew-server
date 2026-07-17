const { default: mongoose } = require("mongoose");
const Trade = require("../../models/Trade");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const { fetchPlanById } = require("./autoPlanService");
const Asset = require("../../models/Asset");
const User = require("../../models/User");
const positionService = require("./positionService");
const Position = require("../../models/Position");
const walletSnapshotService = require("./walletSnapshotService");
const portfolioService = require("./portfolioService");

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
    executionType,
  } = assetData;

  if (!assetId || !orderType || !walletId || !amount || !executionType)
    throw new CustomError("Bad request!", 400);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    const asset = await Asset.findById(assetId).session(session);
    if (!asset) {
      throw new CustomError("Asset not found!", 404);
    }

    const userWallet = await Wallet.findById(walletId).session(session);
    if (!userWallet) {
      throw new CustomError("Wallet not found!", 404);
    }

    const parsedAmount = parseFloat(amount);
    const currentPrice = asset.priceData.current;

    if (userWallet.balance.available < parsedAmount) {
      throw new CustomError("Insufficient funds!", 400);
    }

    let plan;
    if (planId) {
      plan = await fetchPlanById(planId).session(session);
      if (!plan) {
        throw new CustomError("Plan not found!", 404);
      }
    }

    let leverageMultiplier = 1;
    let positionAmount = parsedAmount;
    let marginAmount = parsedAmount;

    if (executionType === "leverage" || executionType === "stoploss") {
      const parsedLeverage = parseFloat(leverage);

      if (leverage && parsedLeverage > 1) {
        leverageMultiplier = parsedLeverage;

        if (leverageMultiplier > 10 || leverageMultiplier < 1) {
          throw new CustomError("Invalid leverage amount!", 400);
        }

        positionAmount = parsedAmount * leverageMultiplier;
        marginAmount = parsedAmount;

        if (userWallet.balance.available < marginAmount) {
          throw new CustomError("Insufficient funds for leveraged trade!", 400);
        }
      }
    }

    const qty = parseFloat(positionAmount / currentPrice).toFixed(6);
    const currentValue = positionAmount;
    const totalReturn = 0;
    const totalReturnPercent = 0;

    userWallet.balance.available -= marginAmount;
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
        slug: userWallet.slug,
      },
      execution: {
        price: currentPrice,
        quantity: parseFloat(qty),
        amount: marginAmount,
        positionAmount: positionAmount,
        interval: interval || null,
        type: executionType,
        leverage:
          executionType === "leverage" || executionType === "stoploss"
            ? leverageMultiplier
            : null,
      },
      performance: {
        currentValue: parseFloat(currentValue.toFixed(4)),
        totalReturn: parseFloat(totalReturn.toFixed(4)),
        totalReturnPercent: parseFloat(totalReturnPercent.toFixed(4)),
        todayReturn: 0,
        todayReturnPercent: 0,
      },
      targets: {
        takeProfit: tp || null,
        stopLoss: sl || null,
        entryPoint: entry || null,
        exitPoint: exit || null,
      },
      fullname: user.fullName,
    };

    const trade = await Trade.create([tradeData], { session });

    const buyTradeForPosition = {
      _id: trade[0]._id,
      userId: trade[0].userId,
      asset: trade[0].asset,
      orderType: "buy",
      execution: {
        quantity: trade[0].execution.quantity,
        amount: trade[0].execution.amount,
        positionAmount: trade[0].execution.positionAmount,
        price: currentPrice,
      },
      wallet: trade[0].wallet,
      planId: trade[0].planId,
      fullname: trade[0].fullname,
      assetType: trade[0].assetType,
      extra: trade[0].extra,
    };

    await positionService.updatePosition(buyTradeForPosition, session);

    const curTrade = trade[0];

    await portfolioService.createPortfolioSnapshot(
      curTrade.userId,
      "trade_buy",
      {
        tradeId: curTrade._id,
        assetSymbol: curTrade.asset.symbol,
      },
      session,
    );

    await walletSnapshotService.createWalletSnapshot(
      curTrade.wallet.id,
      "trade_buy",
      {
        tradeId: curTrade._id,
        assetSymbol: curTrade.asset.symbol,
      },
      session,
    );

    await session.commitTransaction();

    const userInfo = {
      sendTradeAlert: user.mailing.orderNotification,
      email: user.contactInfo.email,
    };

    return {
      success: true,
      trade: trade[0],
      user: userInfo,
    };
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    throw new CustomError(
      error.message || "Failed to process trade",
      error.statusCode || 500,
    );
  } finally {
    session.endSession();
  }
}

async function sellAsset(formData) {
  const { userId, positionId, amount } = formData;
  if (!userId) throw new CustomError("Bad credentials!", 400);
  if (!positionId || !amount)
    throw new CustomError(
      "Bad request! positionId and amount are required",
      400,
    );

  const closeAmount = parseFloat(amount);
  if (isNaN(closeAmount) || closeAmount <= 0) {
    throw new CustomError("Invalid amount! Must be a positive number", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const position = await Position.findById(positionId).session(session);
    if (!position) {
      throw new CustomError("Position not found", 404);
    }
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new CustomError("User not found", 404);
    }

    if (position.userId.toString() !== userId) {
      throw new CustomError("Unauthorized!", 403);
    }

    if (position.status !== "open") {
      throw new CustomError("Position is already closed!", 400);
    }

    const userWallet = await Wallet.findById(position.wallet.id).session(
      session,
    );
    if (!userWallet) throw new CustomError("Wallet not found!", 404);

    const asset = await Asset.findById(position.asset.assetId).session(session);
    if (!asset) throw new CustomError("Asset not found!", 404);

    const currentPrice = asset.priceData.current;

    const positionBaseValue = position.quantity * currentPrice;
    const positionExtra = position.performance.extra || 0;
    const totalPositionValue = positionBaseValue + positionExtra;

    let percentToClose = (closeAmount / totalPositionValue) * 100;
    if (percentToClose >= 99.99) percentToClose = 100;
    if (percentToClose < 0.01 && closeAmount > 0) percentToClose = 0.01;

    const closeRatio = percentToClose / 100;

    const baseValueToClose = positionBaseValue * closeRatio;
    const extraToClose = positionExtra * closeRatio;
    const totalValueToClose = baseValueToClose + extraToClose;
    const quantityToClose = position.quantity * closeRatio;
    const principalToClose = position.amountInvested * closeRatio;
    const profitLossFromBase = baseValueToClose - principalToClose;
    const totalProfitLoss = profitLossFromBase + extraToClose;

    const trades = await Trade.find({
      _id: { $in: position.tradeIds || [] },
      status: "open",
    }).session(session);

    if (trades.length === 0) {
      throw new CustomError("No open trades found for this position", 404);
    }

    const totalTradeAmount = trades.reduce(
      (sum, t) => sum + t.execution.amount,
      0,
    );
    const totalTradeQuantity = trades.reduce(
      (sum, t) => sum + t.execution.quantity,
      0,
    );

    userWallet.balance.available += totalValueToClose;

    if (totalProfitLoss > 0) {
      userWallet.balance.total += totalProfitLoss;
      userWallet.balance.available += totalProfitLoss;
    } else if (totalProfitLoss < 0) {
      const loss = Math.abs(totalProfitLoss);
      userWallet.balance.total -= loss;
      userWallet.balance.available -= loss;
      if (userWallet.balance.available < 0) userWallet.balance.available = 0;
    }

    if (userWallet.balance.total < 0) userWallet.balance.total = 0;
    if (userWallet.balance.available < 0) userWallet.balance.available = 0;
    await userWallet.save({ session });

    const closedTrades = [];
    const updatedTrades = [];

    for (const trade of trades) {
      const tradeRatio = trade.execution.amount / totalTradeAmount;
      const tradeCloseRatio = closeRatio * tradeRatio;
      const tradePercentToClose = tradeCloseRatio * 100;

      const tradeQuantityToClose = trade.execution.quantity * tradeCloseRatio;
      const tradeAmountToClose = trade.execution.amount * tradeCloseRatio;
      const tradeValueToClose =
        (trade.performance.currentValue || trade.execution.positionAmount) *
        tradeCloseRatio;
      const tradeProfitLoss = tradeValueToClose - tradeAmountToClose;

      if (
        tradePercentToClose >= 99.99 ||
        Math.abs(tradeQuantityToClose - trade.execution.quantity) < 0.000001
      ) {
        trade.status = "closed";
        trade.closedAt = new Date();
        trade.performance.currentValue = tradeValueToClose;
        trade.performance.totalReturn = tradeProfitLoss;
        trade.performance.totalReturnPercent =
          (tradeProfitLoss / trade.execution.amount) * 100;

        closedTrades.push(trade);
      } else {
        const remainingRatio = 1 - tradeCloseRatio;

        trade.execution.amount = trade.execution.amount * remainingRatio;
        trade.execution.quantity = trade.execution.quantity * remainingRatio;
        trade.execution.positionAmount =
          trade.execution.positionAmount * remainingRatio;
        trade.performance.currentValue =
          (trade.performance.currentValue || trade.execution.positionAmount) *
          remainingRatio;
        trade.performance.totalReturn =
          trade.performance.totalReturn * remainingRatio;
        trade.performance.totalReturnPercent =
          trade.execution.amount > 0
            ? (trade.performance.totalReturn / trade.execution.amount) * 100
            : 0;

        if (!trade.partialCloses) trade.partialCloses = [];
        trade.partialCloses.push({
          percentClosed: tradePercentToClose,
          principalClosed: tradeAmountToClose,
          profitLossClosed: tradeProfitLoss,
          closedAt: new Date(),
          remainingPrincipal: trade.execution.amount,
          remainingProfitLoss: trade.performance.totalReturn,
          priceAtClose: currentPrice,
          positionClose: true,
        });

        updatedTrades.push(trade);
      }

      await trade.save({ session });
    }

    const sellTradeRecord = {
      userId: userId,
      asset: position.asset,
      planId: position.planId,
      assetType: position.asset.type,
      orderType: "sell",
      wallet: position.wallet,
      execution: {
        price: currentPrice,
        quantity: quantityToClose,
        amount: principalToClose,
        positionAmount: baseValueToClose,
        leverage: 1,
        type: "position_close",
      },
      targets: {
        takeProfit: null,
        stopLoss: null,
        entryPoint: position.averageEntryPrice,
        exitPoint: currentPrice,
      },
      performance: {
        currentValue: baseValueToClose,
        totalReturn: profitLossFromBase,
        totalReturnPercent: (profitLossFromBase / principalToClose) * 100,
        todayReturn: 0,
        todayReturnPercent: 0,
        currentPrice: currentPrice,
      },
      status: "closed",
      closedAt: new Date(),
      closeReason: "user_sell",
      extra: extraToClose,
      fullname: position.fullname,
    };

    const sellTrade = await Trade.create([sellTradeRecord], { session });

    const sellTradeForPosition = {
      _id: sellTrade[0]._id,
      userId: userId,
      asset: position.asset,
      orderType: "sell",
      execution: {
        quantity: quantityToClose,
        amount: principalToClose,
        positionAmount: baseValueToClose,
        price: currentPrice,
      },
      wallet: position.wallet,
      planId: position.planId,
      fullname: position.fullname,
      assetType: position.asset.type,
      extra: extraToClose,
    };

    await positionService.updatePosition(sellTradeForPosition, session);

    const updatedPosition =
      await Position.findById(positionId).session(session);

    await portfolioService.createPortfolioSnapshot(
      position.userId,
      "trade_sell",
      {
        tradeId: position._id,
        assetSymbol: position.asset.symbol,
      },
      session,
    );

    await walletSnapshotService.createWalletSnapshot(
      position.wallet.id,
      "trade_sell",
      {
        tradeId: position._id,
        assetSymbol: position.asset.symbol,
      },
      session,
    );

    await session.commitTransaction();

    session.endSession();

    const userInfo = {
      sendTradeAlert: user.mailing.orderNotification,
      email: user.contactInfo.email,
    };

    return {
      success: true,
      sellTrade: sellTrade[0],
      user: userInfo,
    };
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    session.endSession();
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
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
    if (error instanceof CustomError) throw error;
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
      today.getDate(),
    ).getTime();

    const todayBuys = trades.filter(
      (trade) => trade.createdAt >= startOfToday && trade.orderType === "buy",
    );
    const todaySells = trades.filter(
      (trade) => trade.createdAt >= startOfToday && trade.orderType === "sell",
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
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function searchUserTrades(queryData) {
  const { query } = queryData;
  if (!query || query.length < 2) {
    throw new CustomError("Invalid search term!", 400);
  }
  try {
    const trades = await Trade.find({
      $or: [
        { "asset.name": { $regex: query, $options: "i" } },
        { "asset.symbol": { $regex: query, $options: "i" } },
      ],
    }).lean();
    return trades;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

module.exports = {
  buyAsset,
  sellAsset,
  fetchUserTrades,
  getTradedata,
  searchUserTrades,
};
