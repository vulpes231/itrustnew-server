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
    extra: baseExtra = 0,
  } = assetData;

  if (
    !assetId ||
    orderType !== "buy" ||
    !walletId ||
    amount == null ||
    !executionType
  ) {
    throw new CustomError("Bad request!", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new CustomError("User not found!", 404);

    const asset = await Asset.findById(assetId).session(session);
    if (!asset) throw new CustomError("Asset not found!", 404);

    const userWallet = await Wallet.findById(walletId).session(session);
    if (!userWallet) throw new CustomError("Wallet not found!", 404);

    const parsedAmount = Number(amount);
    const currentPrice = Number(asset.priceData?.current);
    const parsedExtra = Number(baseExtra);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new CustomError("Invalid trade amount!", 400);
    }

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new CustomError("Invalid asset price!", 400);
    }

    if (!Number.isFinite(parsedExtra) || parsedExtra < 0) {
      throw new CustomError("Invalid bonus amount!", 400);
    }

    let plan = null;

    if (planId) {
      plan = await fetchPlanById(planId).session(session);
      if (!plan) throw new CustomError("Plan not found!", 404);
    }

    const isLeveraged =
      executionType === "leverage" || executionType === "stoploss";

    let leverageMultiplier = 1;

    if (isLeveraged) {
      leverageMultiplier = Number(leverage ?? 1);

      if (
        !Number.isFinite(leverageMultiplier) ||
        leverageMultiplier < 1 ||
        leverageMultiplier > 10
      ) {
        throw new CustomError("Invalid leverage amount!", 400);
      }
    }

    // User-funded capital.
    const marginAmount = parsedAmount;

    // Full leveraged market exposure.
    const positionAmount = marginAmount * leverageMultiplier;

    // Broker-funded portion of the exposure.
    const marginDebt = positionAmount - marginAmount;

    // Leverage scales the bonus as requested.
    const leveragedExtra = parsedExtra * leverageMultiplier;

    // Quantity represents the full leveraged exposure.
    const quantity = Number((positionAmount / currentPrice).toFixed(6));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new CustomError("Invalid trade quantity!", 400);
    }

    if (userWallet.balance.available < marginAmount) {
      throw new CustomError("Insufficient funds!", 400);
    }

    userWallet.balance.available -= marginAmount;
    await userWallet.save({ session });

    // At entry, there is no market P/L.
    // The initial total return consists only of the bonus.
    const tradeData = {
      userId,
      asset: {
        assetId: asset._id,
        name: asset.name,
        symbol: asset.symbol,
        img: asset.imageUrl,
      },
      planId: plan?._id || null,
      assetType: asset.type,
      orderType: "buy",
      wallet: {
        id: userWallet._id,
        name: userWallet.name,
        slug: userWallet.slug,
      },
      execution: {
        price: currentPrice,
        quantity,
        amount: marginAmount,
        positionAmount,
        marginDebt,
        interval: interval || null,
        type: executionType,
        leverage: leverageMultiplier,
      },
      performance: {
        currentValue: Number((positionAmount + leveragedExtra).toFixed(4)),
        currentBaseValue: positionAmount,
        totalReturn: Number(leveragedExtra.toFixed(4)),
        totalReturnPercent: Number(
          ((leveragedExtra / marginAmount) * 100).toFixed(4),
        ),
        todayReturn: 0,
        todayReturnPercent: 0,
      },
      extra: Number(leveragedExtra.toFixed(4)),
      targets: {
        takeProfit: tp || null,
        stopLoss: sl || null,
        entryPoint: entry || null,
        exitPoint: exit || null,
      },
      fullname: user.fullName,
    };

    const [createdTrade] = await Trade.create([tradeData], {
      session,
    });

    // Pass every accounting field needed by the position service.
    const buyTradeForPosition = {
      _id: createdTrade._id,
      userId: createdTrade.userId,
      asset: createdTrade.asset,
      orderType: "buy",
      execution: {
        ...(typeof createdTrade.execution.toObject === "function"
          ? createdTrade.execution.toObject()
          : createdTrade.execution),
        price: currentPrice,
      },
      performance: createdTrade.performance,
      wallet: createdTrade.wallet,
      planId: createdTrade.planId,
      fullname: createdTrade.fullname,
      assetType: createdTrade.assetType,
      extra: createdTrade.extra,
    };

    await positionService.updatePosition(buyTradeForPosition, session);

    await portfolioService.createPortfolioSnapshot(
      createdTrade.userId,
      "trade_buy",
      {
        tradeId: createdTrade._id,
        assetSymbol: createdTrade.asset.symbol,
      },
      session,
    );

    await walletSnapshotService.createWalletSnapshot(
      createdTrade.wallet.id,
      "trade_buy",
      {
        tradeId: createdTrade._id,
        assetSymbol: createdTrade.asset.symbol,
      },
      session,
    );

    await session.commitTransaction();

    return {
      success: true,
      trade: createdTrade,
      user,
    };
  } catch (error) {
    await session.abortTransaction();

    console.error(error);

    if (error instanceof CustomError) throw error;

    throw new CustomError(
      error.message || "Failed to process trade",
      error.statusCode || 500,
    );
  } finally {
    await session.endSession();
  }
}

async function sellAsset(formData) {
  const { userId, positionId, amount } = formData;

  if (!userId) {
    throw new CustomError("Bad credentials!", 400);
  }

  if (!positionId || amount == null) {
    throw new CustomError(
      "Bad request! positionId and amount are required",
      400,
    );
  }

  const closeAmount = Number(amount);

  if (!Number.isFinite(closeAmount) || closeAmount <= 0) {
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

    if (position.userId.toString() !== userId.toString()) {
      throw new CustomError("Unauthorized!", 403);
    }

    if (position.status !== "open") {
      throw new CustomError("Position is already closed!", 400);
    }

    const userWallet = await Wallet.findById(position.wallet.id).session(
      session,
    );

    if (!userWallet) {
      throw new CustomError("Wallet not found!", 404);
    }

    const asset = await Asset.findById(position.asset.assetId).session(session);

    if (!asset) {
      throw new CustomError("Asset not found!", 404);
    }

    const currentPrice = Number(asset.priceData?.current);

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new CustomError("Invalid asset price!", 400);
    }

    const positionQuantity = Number(position.quantity || 0);
    const principal = Number(position.amountInvested || 0);
    const positionCost = Number(
      position.positionCost ?? position.performance?.currentBaseValue ?? 0,
    );

    const positionExtra = Number(position.performance?.extra || 0);

    if (positionQuantity <= 0 || principal <= 0 || positionCost <= 0) {
      throw new CustomError("Position has invalid accounting values", 400);
    }

    // Current market value of the FULL leveraged position.
    const positionBaseValue = positionQuantity * currentPrice;

    // The amount available to close includes the bonus.
    const totalPositionValue = positionBaseValue + positionExtra;

    if (closeAmount >= totalPositionValue * 0.999999) {
      // Treat an effectively full-value request as a full close.
    }

    const closeRatio = Math.min(1, closeAmount / totalPositionValue);

    const quantityToClose = positionQuantity * closeRatio;
    const principalToClose = principal * closeRatio;
    const costToClose = positionCost * closeRatio;
    const debtToClose = Number(position.marginDebt || 0) * closeRatio;

    const baseValueToClose = positionBaseValue * closeRatio;

    const extraToClose = positionExtra * closeRatio;

    // Proceeds already contain principal recovery and market P/L.
    const totalProceeds = baseValueToClose + extraToClose;

    const realizedMarketProfit = baseValueToClose - costToClose;

    const realizedProfit = realizedMarketProfit + extraToClose;

    const isFullClose = closeRatio >= 0.999999;

    // Load all buy trades belonging to this aggregated position.
    const trades = await Trade.find({
      _id: { $in: position.tradeIds || [] },
      orderType: "buy",
    }).session(session);

    if (!trades.length) {
      throw new CustomError("No buy trades found for this position", 404);
    }

    // Apply the SAME close ratio to every constituent trade.
    // This preserves the aggregated position's quantity and
    // capital allocation proportions.
    for (const trade of trades) {
      const tradeQuantity = Number(trade.execution?.quantity || 0);

      const tradePrincipal = Number(trade.execution?.amount || 0);

      const tradePositionCost = Number(
        trade.execution?.positionCost ??
          trade.execution?.positionAmount ??
          tradePrincipal,
      );

      const tradeDebt = Number(trade.execution?.marginDebt || 0);

      const tradeExtra = Number(trade.extra || 0);

      const tradeQuantityClosed = tradeQuantity * closeRatio;

      const tradePrincipalClosed = tradePrincipal * closeRatio;

      const tradeCostClosed = tradePositionCost * closeRatio;

      const tradeExtraClosed = tradeExtra * closeRatio;

      const tradeBaseProceeds = tradeQuantityClosed * currentPrice;

      const tradeRealizedProfit =
        tradeBaseProceeds - tradeCostClosed + tradeExtraClosed;

      const remainingRatio = 1 - closeRatio;

      if (!trade.performance) trade.performance = {};

      if (isFullClose) {
        trade.status = "closed";
        trade.closedAt = new Date();

        trade.performance.currentBaseValue = tradeBaseProceeds;

        trade.performance.currentValue = tradeBaseProceeds + tradeExtraClosed;

        trade.performance.totalReturn = tradeRealizedProfit;

        trade.performance.totalReturnPercent =
          tradePrincipal > 0 ? (tradeRealizedProfit / tradePrincipal) * 100 : 0;
      } else {
        trade.execution.amount = tradePrincipal * remainingRatio;

        trade.execution.quantity = tradeQuantity * remainingRatio;

        trade.execution.positionAmount = tradePositionCost * remainingRatio;

        trade.execution.marginDebt = tradeDebt * remainingRatio;

        trade.extra = tradeExtra * remainingRatio;

        const remainingBaseValue =
          tradeQuantity * remainingRatio * currentPrice;

        trade.performance.currentBaseValue = remainingBaseValue;

        trade.performance.currentValue = remainingBaseValue + trade.extra;

        trade.performance.totalReturn =
          remainingBaseValue - tradePositionCost * remainingRatio + trade.extra;

        trade.performance.totalReturnPercent =
          trade.execution.amount > 0
            ? (trade.performance.totalReturn / trade.execution.amount) * 100
            : 0;

        if (!trade.partialCloses) {
          trade.partialCloses = [];
        }

        trade.partialCloses.push({
          percentClosed: Number((closeRatio * 100).toFixed(4)),
          quantityClosed: tradeQuantityClosed,
          principalClosed: tradePrincipalClosed,
          positionCostClosed: tradeCostClosed,
          marginDebtClosed: tradeDebt * closeRatio,
          profitLossClosed: tradeRealizedProfit,
          extraClosed: tradeExtraClosed,
          closedAt: new Date(),
          remainingPrincipal: trade.execution.amount,
          remainingProfitLoss: trade.performance.totalReturn,
          priceAtClose: currentPrice,
          positionClose: true,
        });
      }

      await trade.save({ session });
    }

    // Return proceeds to the available wallet balance ONCE.
    userWallet.balance.available += totalProceeds;

    // Update the aggregate wallet P/L separately.
    // Do not add realizedProfit to available again.
    userWallet.balance.total =
      Number(userWallet.balance.total || 0) + realizedProfit;

    if (userWallet.balance.total < 0) {
      userWallet.balance.total = 0;
    }

    if (userWallet.balance.available < 0) {
      userWallet.balance.available = 0;
    }

    await userWallet.save({ session });

    // Create a separate sell transaction record.
    const sellTradeRecord = {
      userId,
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
        marginDebt: debtToClose,
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
        currentBaseValue: baseValueToClose,
        currentValue: totalProceeds,
        totalReturn: realizedProfit,
        totalReturnPercent:
          principalToClose > 0 ? (realizedProfit / principalToClose) * 100 : 0,
        todayReturn: 0,
        todayReturnPercent: 0,
        currentPrice,
      },

      status: "closed",
      closedAt: new Date(),
      closeReason: "user_sell",
      extra: extraToClose,
      fullname: position.fullname,
    };

    const [sellTrade] = await Trade.create([sellTradeRecord], { session });

    const sellTradeForPosition = {
      _id: sellTrade._id,
      userId,
      asset: position.asset,
      orderType: "sell",

      execution: {
        quantity: quantityToClose,
        amount: principalToClose,
        positionAmount: baseValueToClose,
        marginDebt: debtToClose,
        price: currentPrice,
      },

      wallet: position.wallet,
      planId: position.planId,
      fullname: position.fullname,
      assetType: position.asset.type,
      extra: extraToClose,
    };

    await positionService.updatePosition(sellTradeForPosition, session);

    await portfolioService.createPortfolioSnapshot(
      position.userId,
      "trade_sell",
      {
        tradeId: sellTrade._id,
        assetSymbol: position.asset.symbol,
      },
      session,
    );

    await walletSnapshotService.createWalletSnapshot(
      position.wallet.id,
      "trade_sell",
      {
        tradeId: sellTrade._id,
        assetSymbol: position.asset.symbol,
      },
      session,
    );

    await session.commitTransaction();

    return {
      success: true,
      sellTrade,
      user,
    };
  } catch (error) {
    await session.abortTransaction();

    console.error(error);

    if (error instanceof CustomError) throw error;

    throw new CustomError(
      error.message || "Failed to sell position",
      error.statusCode || 500,
    );
  } finally {
    await session.endSession();
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
    // if (status) filter.status = status;

    const sort = {};
    if (sortBy === "createdAt") sort.createdAt = -1;
    if (sortBy === "status") sort.status = 1;

    const filteredTrades = await Trade.find(filter).sort(sort);
    // .skip((page - 1) * limit)
    // .limit(limit);

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
