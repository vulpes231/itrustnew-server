const { default: mongoose } = require("mongoose");
const Asset = require("../../models/Asset");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const portFolioTracker = require("../user/chartService");

async function createTrade(tradeData) {
  const {
    userId,
    assetId,
    planId,
    orderType,
    executionType,
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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const parsedAmt = parseFloat(amount);

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new CustomError("Invalid request!", 404);
    }

    const wallet = await Wallet.findById(walletId).session(session);
    if (!wallet) {
      throw new CustomError("Invalid wallet!", 404);
    }

    const asset = await Asset.findById(assetId).session(session);
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
        type: executionType,
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
      fullname: user.fullName,
    };

    if (wallet.availableBalance < parsedAmt) {
      throw new CustomError("Insufficient funds!", 400);
    }

    wallet.availableBalance -= parsedAmt;
    await wallet.save({ session });

    const createdTrade = await Trade.create([newTrade], { session });

    await session.commitTransaction();
    session.endSession();

    return {
      trade: createdTrade[0],
      success: true,
      email: user.contactInfo.email,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new CustomError(error.message, 500);
  }
}

async function closeTrade(formData) {
  const { tradeId, percentToClose } = formData;
  if (!tradeId) {
    throw new CustomError("Invalid trade!", 400);
  }

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
    if (!trade) {
      throw new CustomError("Invalid trade!", 404);
    }

    if (trade.status === "closed") {
      throw new CustomError("Trade is already closed!", 400);
    }

    const wallet = await Wallet.findById(trade.wallet.id).session(session);
    if (!wallet) {
      throw new CustomError("Invalid wallet!", 404);
    }

    const asset = await Asset.findById(trade.asset.assetId).session(session);
    if (!asset) {
      throw new CustomError("Asset not found!", 404);
    }

    const currentPrice = asset.priceData.current;
    const entryPrice = trade.execution.price;
    const originalQuantity = trade.execution.quantity;
    const originalAmount = trade.execution.amount;
    const originalLeverage = trade.execution.leverage || 1;
    const extraBonus = trade.extra || 0;

    let currentValue, totalReturn, totalReturnPercent;

    if (trade.orderType === "buy") {
      currentValue = originalQuantity * currentPrice * originalLeverage;
      totalReturn = currentValue - originalAmount;
      totalReturnPercent = (totalReturn / originalAmount) * 100;
    } else if (trade.orderType === "sell") {
      currentValue =
        originalAmount - originalQuantity * currentPrice * originalLeverage;
      totalReturn = currentValue - originalAmount;
      totalReturnPercent = (totalReturn / originalAmount) * 100;
    } else {
      currentValue = originalQuantity * currentPrice;
      totalReturn = currentValue - originalAmount;
      totalReturnPercent = (totalReturn / originalAmount) * 100;
    }

    const totalCurrentValue = currentValue + extraBonus;
    const totalProfitLoss = totalReturn + extraBonus;
    const totalProfitLossPercentage = (totalProfitLoss / originalAmount) * 100;

    const closeRatio = parserPercent / 100;
    const principalToClose = originalAmount * closeRatio;
    const profitLossToClose = totalProfitLoss * closeRatio;
    const currentValueToClose = totalCurrentValue * closeRatio;

    const remainingPrincipal = originalAmount * (1 - closeRatio);
    const remainingProfitLoss = totalProfitLoss * (1 - closeRatio);
    const remainingCurrentValue = totalCurrentValue * (1 - closeRatio);
    const remainingQuantity = originalQuantity * (1 - closeRatio);
    const remainingBonus = extraBonus * (1 - closeRatio);

    wallet.availableBalance += principalToClose;

    if (profitLossToClose > 0) {
      wallet.totalBalance += profitLossToClose;
      wallet.availableBalance += profitLossToClose;
    } else if (profitLossToClose < 0) {
      const loss = Math.abs(profitLossToClose);
      wallet.totalBalance -= loss;
      wallet.availableBalance -= loss;

      if (wallet.availableBalance < 0) {
        wallet.availableBalance = 0;
      }
    }

    if (wallet.totalBalance < 0) wallet.totalBalance = 0;
    if (wallet.availableBalance < 0) wallet.availableBalance = 0;

    await wallet.save({ session });

    if (parserPercent === 100) {
      trade.performance.currentValue = totalCurrentValue;
      trade.performance.totalReturn = totalProfitLoss;
      trade.performance.totalReturnPercent = totalProfitLossPercentage;
      trade.targets.exitPoint = currentPrice;
      trade.status = "closed";
      trade.closedAt = new Date();
      trade.closeReason = "manual_close";
    } else {
      trade.execution.amount = remainingPrincipal;
      trade.execution.quantity = remainingQuantity;

      trade.performance.currentValue = remainingCurrentValue;
      trade.performance.totalReturn = remainingProfitLoss;
      trade.performance.totalReturnPercent =
        (remainingProfitLoss / remainingPrincipal) * 100;

      trade.extra = remainingBonus;

      trade.status = "open";

      if (!trade.partialCloses) {
        trade.partialCloses = [];
      }

      trade.partialCloses.push({
        percentClosed: parserPercent,
        principalClosed: principalToClose,
        profitLossClosed: profitLossToClose,
        currentValueClosed: currentValueToClose,
        closedAt: new Date(),
        exitPrice: currentPrice,
        remainingPrincipal: remainingPrincipal,
        remainingProfitLoss: remainingProfitLoss,
        remainingQuantity: remainingQuantity,
      });
    }

    await trade.save({ session });

    await portFolioTracker.recordTrade(
      trade.userId,
      profitLossToClose,
      `Trade ${parserPercent === 100 ? "closed" : `partially closed (${parserPercent}%)`}: ${trade.asset.symbol} ${trade.orderType} - ${
        profitLossToClose >= 0 ? "Profit" : "Loss"
      } of $${Math.abs(profitLossToClose).toFixed(2)}`,
    );

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      trade,
      closedPortion: {
        percentClosed: parserPercent,
        principalClosed: principalToClose,
        profitLossClosed: profitLossToClose,
        currentValueClosed: currentValueToClose,
      },
      wallet: {
        totalBalance: wallet.totalBalance,
        availableBalance: wallet.availableBalance,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new CustomError(error.message, 500);
  }
}

async function updateTradePerformance(tradeId, externalSession = null) {
  const session = externalSession || (await mongoose.startSession());
  const ownsSession = !externalSession;

  if (ownsSession) session.startTransaction();

  try {
    const trade = await Trade.findById(tradeId).session(session);
    if (!trade || trade.status !== "open")
      throw new CustomError("Cannot update closed trade!", 400);

    const asset = await Asset.findById(trade.asset.assetId).session(session);
    if (!asset) return null;

    const currentPrice = asset.priceData.current;
    const entryPrice = trade.execution.price;
    const quantity = trade.execution.quantity;
    const leverage = trade.execution.leverage || 1;
    const extraBonus = trade.extra || 0;

    let currentValue, totalReturn, totalReturnPercent;

    if (trade.orderType === "buy") {
      currentValue = quantity * currentPrice * leverage;
      totalReturn = currentValue - trade.execution.amount;
      totalReturnPercent = (totalReturn / trade.execution.amount) * 100;
    } else if (trade.orderType === "sell") {
      currentValue =
        trade.execution.amount - quantity * currentPrice * leverage;
      totalReturn = currentValue - trade.execution.amount;
      totalReturnPercent = (totalReturn / trade.execution.amount) * 100;
    } else {
      currentValue = quantity * currentPrice;
      totalReturn = currentValue - trade.execution.amount;
      totalReturnPercent = (totalReturn / trade.execution.amount) * 100;
    }

    const totalCurrentValue = currentValue + extraBonus;
    const totalProfitLoss = totalReturn + extraBonus;
    const totalProfitLossPercentage =
      (totalProfitLoss / trade.execution.amount) * 100;

    trade.performance.currentValue = totalCurrentValue;
    trade.performance.totalReturn = totalProfitLoss;
    trade.performance.totalReturnPercent = totalProfitLossPercentage;
    trade.performance.currentPrice = currentPrice;

    // trade.execution.

    let tradeClosed = false;
    let closeReason = "";

    if (
      trade.targets.takeProfit &&
      totalReturnPercent >= trade.targets.takeProfit
    ) {
      trade.status = "closed";
      trade.closedAt = new Date();
      trade.closeReason = "take_profit";
      tradeClosed = true;
      closeReason = "Take Profit";
    } else if (
      trade.targets.stopLoss &&
      totalReturnPercent <= trade.targets.stopLoss
    ) {
      trade.status = "closed";
      trade.closedAt = new Date();
      trade.closeReason = "stop_loss";
      tradeClosed = true;
      closeReason = "Stop Loss";
    }

    trade.markModified("performance");
    await trade.save({ session });

    if (tradeClosed) {
      const wallet = await Wallet.findById(trade.wallet.id).session(session);
      if (wallet) {
        wallet.availableBalance += totalCurrentValue;
        wallet.totalBalance += totalProfitLoss;
        await wallet.save({ session });
      }

      await portFolioTracker.recordTrade(
        trade.userId,
        totalProfitLoss,
        `Trade closed (${closeReason}): ${trade.asset.symbol} ${
          trade.orderType
        } - ${totalProfitLoss >= 0 ? "Profit" : "Loss"} of $${Math.abs(
          totalProfitLoss,
        ).toFixed(2)}`,
      );
    }

    if (ownsSession) {
      await session.commitTransaction();
      session.endSession();
    }

    return trade;
  } catch (error) {
    if (ownsSession) {
      await session.abortTransaction();
      session.endSession();
    }
    throw error;
  }
}

async function editTradeData(tradeData) {
  const { extra, leverage, sl, tp, tradeId } = tradeData;
  if (!tradeId) {
    throw new CustomError("Invalid trade!", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const trade = await Trade.findById(tradeId).session(session);
    if (!trade || trade.status !== "open")
      throw new CustomError("Cannot update closed trade!", 400);

    const parsedExtra = parseFloat(extra);

    if (extra && parsedExtra > 0) {
      await portFolioTracker.recordDeposit(
        trade.userId,
        parsedExtra,
        `Extra bonus added to trade: ${trade.asset.symbol}`,
      );

      trade.extra += parsedExtra;
    }

    if (leverage) trade.execution.leverage = leverage;
    if (sl) trade.targets.stopLoss = sl;
    if (tp) trade.targets.takeProfit = tp;

    await trade.save({ session });

    // await updateTradePerformance(tradeId);
    await updateTradePerformance(tradeId, session);

    await session.commitTransaction();
    session.endSession();

    return trade;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
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

async function getTradeByUserId(formData) {
  const { userId } = formData;
  if (!userId) {
    throw new CustomError("Bad request!", 400);
  }
  try {
    const userTrades = await Trade.find({
      userId,
    }).lean();

    return userTrades;
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
  getTradeByUserId,
};
