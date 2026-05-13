const { default: mongoose } = require("mongoose");
const Trade = require("../../models/Trade");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const { fetchPlanById } = require("./autoPlanService");
const Asset = require("../../models/Asset");
const User = require("../../models/User");
const portfolioService = require("./portfolioService");
const positionService = require("./positionService");

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

    await positionService.updatePosition(trade[0], session);

    await session.commitTransaction();

    await portfolioService.updatePortfolioValue(
      trade[0].userId,
      -trade[0].execution.amount,
      "trade_buy",
      {
        transactionId: trade[0]._id,
        assetSymbol: trade[0].asset.symbol,
        tradeAmount: trade[0].execution.amount,
        quantity: trade[0].execution.quantity,
        pricePerUnit: asset.priceData.current,
      },
    );

    return {
      assetName: trade[0].asset.name,
      assetQty: trade[0].execution.quantity,
      tradeId: trade[0]._id,
    };
  } catch (error) {
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
  const { userId, tradeId, percentToClose } = formData;
  if (!userId) throw new CustomError("Bad credentials!", 400);
  if (!tradeId || !percentToClose) throw new CustomError("Bad request!", 400);

  const parserPercent = parseFloat(percentToClose);

  const validPercentages = [25, 50, 75, 100];
  if (!validPercentages.includes(parserPercent)) {
    throw new CustomError(
      "Invalid percentToClose! Must be 25, 50, 75, or 100",
      400,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const trade = await Trade.findById(tradeId).session(session);
    if (!trade) throw new CustomError("Trade not found!", 404);

    if (trade.status === "closed") {
      throw new CustomError("Trade already closed!", 400);
    }

    if (trade.userId.toString() !== userId) {
      throw new CustomError("Unauthorized!", 403);
    }

    const userWallet = await Wallet.findById(trade.wallet.id).session(session);
    if (!userWallet) throw new CustomError("Wallet not found!", 404);

    const asset = await Asset.findById(trade.asset.assetId).session(session);
    if (!asset) throw new CustomError("Asset not found!", 404);

    const currentPrice = asset.priceData.current;
    const currentPositionValue = trade.execution.quantity * currentPrice;
    const currentTotalReturn = currentPositionValue - trade.execution.amount;

    trade.performance.currentPrice = currentPrice;
    trade.performance.currentValue = currentPositionValue;
    trade.performance.totalReturn = currentTotalReturn;
    trade.performance.totalReturnPercent =
      (currentTotalReturn / trade.execution.amount) * 100;

    const closeRatio = parserPercent / 100;
    const principalToClose = trade.execution.amount * closeRatio;
    const profitOrLossToClose = trade.performance.totalReturn * closeRatio;
    const quantityToClose = trade.execution.quantity * closeRatio;
    const valueToClose = currentPositionValue * closeRatio;

    const remainingPrincipal = trade.execution.amount * (1 - closeRatio);
    const remainingProfitOrLoss =
      trade.performance.totalReturn * (1 - closeRatio);
    const remainingQuantity = trade.execution.quantity * (1 - closeRatio);
    const remainingValue = currentPositionValue * (1 - closeRatio);

    userWallet.balance.available += valueToClose;

    if (profitOrLossToClose > 0) {
      userWallet.balance.total += profitOrLossToClose;
      userWallet.balance.available += profitOrLossToClose;
    } else if (profitOrLossToClose < 0) {
      const loss = Math.abs(profitOrLossToClose);
      userWallet.balance.total -= loss;
      userWallet.balance.available -= loss;

      if (userWallet.balance.available < 0) {
        userWallet.balance.available = 0;
      }
    }

    if (userWallet.balance.total < 0) userWallet.balance.total = 0;
    if (userWallet.balance.available < 0) userWallet.balance.available = 0;

    await userWallet.save({ session });

    if (parserPercent === 100) {
      trade.status = "closed";
      trade.closedAt = new Date();
    } else {
      trade.execution.amount = remainingPrincipal;
      trade.execution.quantity = remainingQuantity;
      trade.execution.positionAmount = remainingValue;
      trade.performance.totalReturn = remainingProfitOrLoss;
      trade.performance.totalReturnPercent =
        (remainingProfitOrLoss / remainingPrincipal) * 100;
      trade.performance.currentValue = remainingValue;
      trade.status = "open";

      if (!trade.partialCloses) {
        trade.partialCloses = [];
      }

      trade.partialCloses.push({
        percentClosed: parserPercent,
        principalClosed: principalToClose,
        profitLossClosed: profitOrLossToClose,
        closedAt: new Date(),
        remainingPrincipal: remainingPrincipal,
        remainingProfitLoss: remainingProfitOrLoss,
      });
    }

    await trade.save({ session });

    const position = await Position.findOne({
      userId: trade.userId,
      "asset.assetId": trade.asset.assetId,
      "wallet.id": trade.wallet.id,
      status: "open",
    }).session(session);

    if (position) {
      if (parserPercent === 100) {
        position.status = "closed";
        position.performance.totalReturn = currentTotalReturn;
        position.performance.totalReturnPercent =
          (currentTotalReturn / position.amountInvested) * 100;
        position.performance.currentValue = 0;
        position.closedAt = new Date();
      } else {
        const positionCloseRatio = principalToClose / position.amountInvested;
        const positionPrincipalToClose =
          position.amountInvested * positionCloseRatio;
        const positionValueToClose =
          position.performance.currentValue * positionCloseRatio;
        const positionProfitToClose =
          position.performance.totalReturn * positionCloseRatio;

        const remainingPositionPrincipal =
          position.amountInvested - positionPrincipalToClose;
        const remainingPositionValue =
          position.performance.currentValue - positionValueToClose;
        const remainingPositionProfit =
          position.performance.totalReturn - positionProfitToClose;

        if (!position.partialCloses) {
          position.partialCloses = [];
        }

        position.partialCloses.push({
          percentClosed: parserPercent,
          principalClosed: positionPrincipalToClose,
          profitLossClosed: positionProfitToClose,
          closedAt: new Date(),
          remainingPrincipal: remainingPositionPrincipal,
          remainingProfitLoss: remainingPositionProfit,
        });

        position.amountInvested = remainingPositionPrincipal;
        position.performance.currentValue = remainingPositionValue;
        position.performance.totalReturn = remainingPositionProfit;
        position.performance.totalReturnPercent =
          (remainingPositionProfit / remainingPositionPrincipal) * 100;

        const todayReturn =
          remainingPositionValue -
          (position.performance.currentValue || remainingPositionValue);
        position.performance.todayReturn = todayReturn;
        position.performance.todayReturnPercent = position.performance
          .currentValue
          ? (todayReturn / position.performance.currentValue) * 100
          : 0;
      }

      await position.save({ session });
    }

    await session.commitTransaction();

    await portfolioService.updatePortfolioValue(
      trade.userId,
      profitOrLossToClose,
      "trade_sell",
      {
        transactionId: trade._id,
        assetSymbol: trade.asset.symbol,
        tradeAmount: profitOrLossToClose,
        quantity: quantityToClose,
        pricePerUnit: currentPrice,
      },
    );

    session.endSession();

    return {
      success: true,
      trade,
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
