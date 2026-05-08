const { default: mongoose } = require("mongoose");
const Trade = require("../../models/Trade");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const { fetchAssetById } = require("../assetService");
const { fetchPlanById } = require("./autoPlanService");
const Asset = require("../../models/Asset");
const User = require("../../models/User");

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
      await session.abortTransaction();
      throw new CustomError("User not found!", 404);
    }
    const asset = await Asset.findById(assetId).session(session);
    if (!asset) {
      await session.abortTransaction();
      throw new CustomError("Asset not found!", 404);
    }

    const userWallet = await Wallet.findById(walletId).session(session);
    if (!userWallet) {
      await session.abortTransaction();
      throw new CustomError("Wallet not found!", 404);
    }

    const parsedAmount = parseFloat(amount);
    const currentPrice = asset.priceData.current;

    if (userWallet.availableBalance < parsedAmount) {
      await session.abortTransaction();
      throw new CustomError("Insufficient funds!", 400);
    }

    let plan;
    if (planId) {
      plan = await fetchPlanById(planId).session(session);
      if (!plan) {
        await session.abortTransaction();
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
          await session.abortTransaction();
          throw new CustomError("Invalid leverage amount!", 400);
        }

        positionAmount = parsedAmount * leverageMultiplier;
        marginAmount = parsedAmount;

        if (userWallet.availableBalance < marginAmount) {
          await session.abortTransaction();
          throw new CustomError("Insufficient funds for leveraged trade!", 400);
        }
      }
    }

    const qty = parseFloat(positionAmount / currentPrice).toFixed(6);

    let currentValue;
    let totalReturn;
    let totalReturnPercent;

    if (orderType === "buy") {
      currentValue = positionAmount;
      totalReturn = 0;
      totalReturnPercent = 0;
    }
    {
      currentValue = positionAmount;
      totalReturn = 0;
      totalReturnPercent = 0;
    }

    userWallet.availableBalance -= marginAmount;
    // userWallet.totalInvested += marginAmount;
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
      leverage:
        executionType === "leverage" || executionType === "stoploss"
          ? leverageMultiplier
          : null,
      wallet: {
        id: userWallet._id,
        name: userWallet.name,
      },
      execution: {
        price: currentPrice,
        quantity: qty,
        amount: marginAmount,
        positionAmount: positionAmount,
        interval: interval || null,
        type: executionType,
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
    await session.commitTransaction();

    const assetName = trade[0].asset.name;
    const assetQty = trade[0].execution.quantity;

    return {
      assetName,
      assetQty,
    };
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof CustomError) {
      throw error;
    }

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

    // Calculate partial amounts based on percentToClose
    const closeRatio = percentToClose / 100;
    const principalToClose = trade.execution.amount * closeRatio;
    const profitOrLossToClose = trade.performance.totalReturn * closeRatio;

    // Calculate remaining trade amounts
    const remainingPrincipal = trade.execution.amount * (1 - closeRatio);
    const remainingProfitOrLoss =
      trade.performance.totalReturn * (1 - closeRatio);

    // Update wallet with the closed portion
    userWallet.availableBalance += principalToClose;

    if (profitOrLossToClose > 0) {
      userWallet.totalBalance += profitOrLossToClose;
      userWallet.availableBalance += profitOrLossToClose;
    } else if (profitOrLossToClose < 0) {
      const loss = Math.abs(profitOrLossToClose);
      userWallet.totalBalance -= loss;
      userWallet.availableBalance -= loss;

      if (userWallet.availableBalance < 0) {
        userWallet.availableBalance = 0;
      }
    }

    if (userWallet.totalBalance < 0) userWallet.totalBalance = 0;
    if (userWallet.availableBalance < 0) userWallet.availableBalance = 0;

    await userWallet.save({ session });

    // Update or close trade based on percentToClose
    if (percentToClose === 100) {
      // Fully close the trade
      trade.status = "closed";
      trade.closedAt = new Date();
    } else {
      // Partially close - update trade with remaining amounts
      trade.execution.amount = remainingPrincipal;
      trade.performance.totalReturn = remainingProfitOrLoss;
      trade.status = "open";

      if (!trade.partialCloses) {
        trade.partialCloses = [];
      }

      trade.partialCloses.push({
        percentClosed: percentToClose,
        principalClosed: principalToClose,
        profitLossClosed: profitOrLossToClose,
        closedAt: new Date(),
        remainingPrincipal: remainingPrincipal,
        remainingProfitLoss: remainingProfitOrLoss,
      });
    }

    await trade.save({ session });

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      trade,
      wallet: {
        totalBalance: userWallet.totalBalance,
        availableBalance: userWallet.availableBalance,
      },
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
