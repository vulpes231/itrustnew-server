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
const {
  calculateMarketValue,
  calculatePartialClose,
  calculateRealizedProfit,
  calculateReturnPercent,
  calculatePositionTotals,
  hasNoRemainingExposure,
} = require("../../utils/trading/positionCalculation");

const {
  requireFiniteNumber,
  validateMarketPrice,
  validateTradeIdentifiers,
} = require("../../utils/trading/tradeValidation");

async function buyAsset(userId, assetData) {
  if (!userId) {
    throw new CustomError("Bad credentials!", 400);
  }

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

    const marginAmount = Number(amount);
    const currentPrice = Number(asset.priceData?.current);
    const parsedExtra = Number(baseExtra);

    if (!Number.isFinite(marginAmount) || marginAmount <= 0) {
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

      if (!plan) {
        throw new CustomError("Plan not found!", 404);
      }
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

    const principal = marginAmount;

    const requestedExposure = principal * leverageMultiplier;

    const quantity = Number((requestedExposure / currentPrice).toFixed(6));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new CustomError("Invalid trade quantity!", 400);
    }

    const positionCost = Number((quantity * currentPrice).toFixed(8));

    const positionAmount = positionCost;

    const marginDebt = Math.max(0, positionAmount - principal);

    const leveragedExtra = Number(
      (parsedExtra * leverageMultiplier).toFixed(4),
    );

    if (Number(userWallet.balance.available) < principal) {
      throw new CustomError("Insufficient funds!", 400);
    }

    userWallet.balance.available =
      Number(userWallet.balance.available) - principal;

    await userWallet.save({ session });

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

        // User-funded capital.
        amount: principal,

        // Gross exposure at entry. Keep this as historical entry data.
        positionAmount,

        // Actual entry cost basis.
        positionCost,

        marginDebt,
        interval: interval || null,
        type: executionType,
        leverage: leverageMultiplier,
      },

      performance: {
        currentValue: Number((positionAmount + leveragedExtra).toFixed(4)),

        currentBaseValue: positionAmount,

        totalReturn: leveragedExtra,

        totalReturnPercent: Number(
          ((leveragedExtra / principal) * 100).toFixed(4),
        ),

        todayReturn: 0,
        todayReturnPercent: 0,
      },

      extra: leveragedExtra,

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

    const createdExecution =
      typeof createdTrade.execution.toObject === "function"
        ? createdTrade.execution.toObject()
        : createdTrade.execution;

    const buyTradeForPosition = {
      _id: createdTrade._id,
      userId: createdTrade.userId,
      asset: createdTrade.asset,
      orderType: "buy",

      execution: {
        ...createdExecution,
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
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error(error);

    if (error instanceof CustomError) {
      throw error;
    }

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

  let closeAmount;

  try {
    closeAmount = requireFiniteNumber(amount, "Close amount");
  } catch {
    throw new CustomError("Invalid amount!", 400);
  }

  if (closeAmount <= 0) {
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

    let currentPrice;

    try {
      currentPrice = validateMarketPrice(asset.priceData?.current);
    } catch {
      throw new CustomError("Invalid asset price!", 400);
    }

    const positionQuantity = Number(position.quantity);
    const principal = Number(position.amountInvested);
    const positionExtra = Number(position.performance?.extra ?? 0);
    const marginDebt = Number(position.marginDebt ?? 0);

    if (
      !Number.isFinite(positionQuantity) ||
      positionQuantity <= 0 ||
      !Number.isFinite(principal) ||
      principal <= 0 ||
      !Number.isFinite(positionExtra) ||
      positionExtra < 0 ||
      !Number.isFinite(marginDebt) ||
      marginDebt < 0
    ) {
      throw new CustomError("Position has invalid accounting values", 400);
    }

    // Load the original buys to support legacy positions without
    // positionCost or averageEntryPrice.
    const trades = await Trade.find({
      _id: { $in: position.tradeIds || [] },
      orderType: "buy",
    }).session(session);

    if (!trades.length) {
      throw new CustomError("No buy trades found for this position", 404);
    }

    // Reconstruct entry cost from historical trade information.
    // Never use currentBaseValue as entry cost: it is market value.
    let tradeCostTotal = 0;
    let tradeQuantityTotal = 0;

    for (const trade of trades) {
      const tradeQuantity = Number(trade.execution?.quantity ?? 0);
      const tradePrice = Number(trade.execution?.price ?? 0);
      const storedTradeCost = Number(trade.execution?.positionCost);
      const storedPositionAmount = Number(trade.execution?.positionAmount);
      const tradePrincipal = Number(trade.execution?.amount ?? 0);

      if (!Number.isFinite(tradeQuantity) || tradeQuantity <= 0) {
        continue;
      }

      let entryCost;

      if (Number.isFinite(storedTradeCost) && storedTradeCost > 0) {
        entryCost = storedTradeCost;
      } else if (
        Number.isFinite(storedPositionAmount) &&
        storedPositionAmount > 0
      ) {
        // Legacy buy trades used positionAmount for gross exposure.
        entryCost = storedPositionAmount;
      } else if (Number.isFinite(tradePrice) && tradePrice > 0) {
        entryCost = tradeQuantity * tradePrice;
      } else if (Number.isFinite(tradePrincipal) && tradePrincipal > 0) {
        entryCost = tradePrincipal;
      } else {
        continue;
      }

      tradeCostTotal += entryCost;
      tradeQuantityTotal += tradeQuantity;
    }

    const storedPositionCost = Number(position.positionCost);
    const averageEntryPrice = Number(position.averageEntryPrice);

    let positionCost;

    if (Number.isFinite(storedPositionCost) && storedPositionCost > 0) {
      positionCost = storedPositionCost;
    } else if (Number.isFinite(averageEntryPrice) && averageEntryPrice > 0) {
      positionCost = positionQuantity * averageEntryPrice;
    } else if (tradeQuantityTotal > 0 && tradeCostTotal > 0) {
      // If the position was partially closed historically, scale the
      // original trade cost to the quantity still held.
      positionCost = (tradeCostTotal / tradeQuantityTotal) * positionQuantity;
    } else {
      // Last-resort legacy fallback: assume no market P/L because
      // the historical entry basis is unavailable.
      positionCost = positionQuantity * currentPrice;
    }

    if (!Number.isFinite(positionCost) || positionCost <= 0) {
      throw new CustomError("Unable to determine position entry cost", 400);
    }

    // Current market value excludes the bonus.
    const positionBaseValue = calculateMarketValue(
      positionQuantity,
      currentPrice,
    );

    const totalPositionValue = positionBaseValue + positionExtra;

    if (!Number.isFinite(totalPositionValue) || totalPositionValue <= 0) {
      throw new CustomError("Invalid position market value", 400);
    }

    // The requested close amount is interpreted as current position
    // value including extra. A request >= full value closes everything.
    const isRequestedFullClose = closeAmount >= totalPositionValue * 0.999999;

    const closeRatio = isRequestedFullClose
      ? 1
      : Math.min(1, closeAmount / totalPositionValue);

    const close = calculatePartialClose({
      quantity: positionQuantity,
      principal,
      positionCost,
      marginDebt,
      baseValue: positionBaseValue,
      extra: positionExtra,
      closeRatio,
    });

    const {
      quantityClosed: quantityToClose,
      principalClosed: principalToClose,
      costClosed: costToClose,
      debtClosed: debtToClose,
      marketValueClosed: baseValueToClose,
      extraClosed: extraToClose,
      totalProceeds,
      realizedProfit,
      remainingQuantity,
      remainingPrincipal,
      remainingCost,
      remainingDebt,
      remainingBaseValue,
      remainingExtra,
      isFullClose,
    } = close;

    // Repay the borrowed portion from the gross close proceeds.
    // Bonus is included in proceeds and profit.
    const netWalletCredit = totalProceeds - debtToClose;

    const currentAvailable = Number(userWallet.balance.available ?? 0);

    const currentTotal = Number(userWallet.balance.total ?? 0);

    if (!Number.isFinite(currentAvailable) || !Number.isFinite(currentTotal)) {
      throw new CustomError("Wallet has invalid balances", 400);
    }

    // If market value falls below outstanding debt, net proceeds may
    // be negative. Do not silently turn that debt into a zero-cost
    // close or allow a negative available balance.
    if (currentAvailable + netWalletCredit < 0) {
      throw new CustomError(
        "Insufficient wallet balance to cover the remaining margin debt",
        400,
      );
    }

    const now = new Date();

    // Update each original buy trade proportionally.
    for (const trade of trades) {
      const tradeQuantity = Number(trade.execution?.quantity ?? 0);
      const tradePrincipal = Number(trade.execution?.amount ?? 0);
      const tradeDebt = Number(trade.execution?.marginDebt ?? 0);
      const tradeExtra = Number(trade.extra ?? 0);

      const storedTradeCost = Number(trade.execution?.positionCost);
      const storedPositionAmount = Number(trade.execution?.positionAmount);
      const tradePrice = Number(trade.execution?.price ?? 0);

      let tradePositionCost;

      if (Number.isFinite(storedTradeCost) && storedTradeCost > 0) {
        tradePositionCost = storedTradeCost;
      } else if (
        Number.isFinite(storedPositionAmount) &&
        storedPositionAmount > 0
      ) {
        tradePositionCost = storedPositionAmount;
      } else if (
        Number.isFinite(tradePrice) &&
        tradePrice > 0 &&
        tradeQuantity > 0
      ) {
        tradePositionCost = tradeQuantity * tradePrice;
      } else {
        tradePositionCost = tradePrincipal;
      }

      if (
        !Number.isFinite(tradeQuantity) ||
        tradeQuantity < 0 ||
        !Number.isFinite(tradePrincipal) ||
        tradePrincipal < 0 ||
        !Number.isFinite(tradePositionCost) ||
        tradePositionCost < 0 ||
        !Number.isFinite(tradeDebt) ||
        tradeDebt < 0 ||
        !Number.isFinite(tradeExtra) ||
        tradeExtra < 0
      ) {
        throw new CustomError(
          `Invalid accounting values for trade ${trade._id}`,
          400,
        );
      }

      if (tradeQuantity === 0) {
        continue;
      }

      const tradeBaseValue = calculateMarketValue(tradeQuantity, currentPrice);

      const tradeClose = calculatePartialClose({
        quantity: tradeQuantity,
        principal: tradePrincipal,
        positionCost: tradePositionCost,
        marginDebt: tradeDebt,
        baseValue: tradeBaseValue,
        extra: tradeExtra,
        closeRatio,
      });

      const {
        quantityClosed,
        principalClosed: tradePrincipalClosed,
        costClosed: tradeCostClosed,
        debtClosed: tradeDebtClosed,
        marketValueClosed: tradeBaseProceeds,
        extraClosed: tradeExtraClosed,
        remainingQuantity: tradeRemainingQuantity,
        remainingPrincipal: tradeRemainingPrincipal,
        remainingCost: tradeRemainingCost,
        remainingDebt: tradeRemainingDebt,
        remainingBaseValue: tradeRemainingBaseValue,
        remainingExtra: tradeRemainingExtra,
      } = tradeClose;

      const tradeRealizedProfit = calculateRealizedProfit({
        marketValue: tradeBaseProceeds,
        positionCost: tradeCostClosed,
        extra: tradeExtraClosed,
      });

      if (!trade.performance) {
        trade.performance = {};
      }

      if (isFullClose) {
        trade.status = "closed";
        trade.closedAt = now;

        trade.performance.currentBaseValue = tradeBaseProceeds;
        trade.performance.currentValue = tradeBaseProceeds + tradeExtraClosed;
        trade.performance.totalReturn = tradeRealizedProfit;

        trade.performance.totalReturnPercent = calculateReturnPercent({
          profit: tradeRealizedProfit,
          principal: tradePrincipal,
        });
      } else {
        trade.execution.amount = tradeRemainingPrincipal;
        trade.execution.quantity = tradeRemainingQuantity;

        // Keep positionAmount as the original gross exposure.
        // Store remaining entry cost separately.
        trade.execution.positionCost = tradeRemainingCost;
        trade.execution.marginDebt = tradeRemainingDebt;

        trade.extra = tradeRemainingExtra;

        trade.performance.currentBaseValue = tradeRemainingBaseValue;
        trade.performance.currentValue =
          tradeRemainingBaseValue + tradeRemainingExtra;

        trade.performance.totalReturn =
          tradeRemainingBaseValue - tradeRemainingCost + tradeRemainingExtra;

        trade.performance.totalReturnPercent = calculateReturnPercent({
          profit: trade.performance.totalReturn,
          principal: tradeRemainingPrincipal,
        });

        if (!trade.partialCloses) {
          trade.partialCloses = [];
        }

        trade.partialCloses.push({
          percentClosed: Number((closeRatio * 100).toFixed(4)),
          quantityClosed,
          principalClosed: tradePrincipalClosed,
          positionCostClosed: tradeCostClosed,
          marginDebtClosed: tradeDebtClosed,
          profitLossClosed: tradeRealizedProfit,
          extraClosed: tradeExtraClosed,
          closedAt: now,
          remainingQuantity: tradeRemainingQuantity,
          remainingPrincipal: tradeRemainingPrincipal,
          remainingProfitLoss:
            tradeRemainingBaseValue - tradeRemainingCost + tradeRemainingExtra,
          priceAtClose: currentPrice,
        });
      }

      await trade.save({ session });
    }

    // Update the position exactly once.
    if (isFullClose) {
      position.status = "closed";
      position.closedAt = now;

      position.quantity = 0;
      position.amountInvested = 0;
      position.positionCost = 0;
      position.marginDebt = 0;
      position.averageEntryPrice = 0;

      if (!position.performance) {
        position.performance = {};
      }

      position.performance.currentBaseValue = 0;
      position.performance.currentValue = 0;
      position.performance.extra = 0;
      position.performance.totalReturn = realizedProfit;

      position.performance.totalReturnPercent =
        principal > 0 ? (realizedProfit / principal) * 100 : 0;
    } else {
      position.quantity = remainingQuantity;
      position.amountInvested = remainingPrincipal;
      position.positionCost = remainingCost;
      position.marginDebt = remainingDebt;

      position.averageEntryPrice =
        remainingQuantity > 0 ? remainingCost / remainingQuantity : 0;

      if (!position.performance) {
        position.performance = {};
      }

      position.performance.currentBaseValue = remainingBaseValue;
      position.performance.currentValue = remainingBaseValue + remainingExtra;
      position.performance.extra = remainingExtra;

      position.performance.totalReturn =
        remainingBaseValue - remainingCost + remainingExtra;

      position.performance.totalReturnPercent =
        remainingPrincipal > 0
          ? (position.performance.totalReturn / remainingPrincipal) * 100
          : 0;
    }

    if (!position.partialCloses) {
      position.partialCloses = [];
    }

    position.partialCloses.push({
      percentClosed: Number((closeRatio * 100).toFixed(4)),
      quantityClosed: quantityToClose,
      principalClosed: principalToClose,
      positionCostClosed: costToClose,
      marginDebtClosed: debtToClose,
      marketValueClosed: baseValueToClose,
      extraClosed: extraToClose,

      // Gross proceeds and wallet credit are different when leveraged.
      proceeds: totalProceeds,
      marginDebtRepaid: debtToClose,
      netWalletCredit,

      marketProfitClosed: baseValueToClose - costToClose,
      profitLossClosed: realizedProfit,

      closedAt: now,
      remainingQuantity,
      remainingPrincipal,
      remainingPositionCost: remainingCost,
      remainingMarginDebt: remainingDebt,
      remainingExtra,

      remainingProfitLoss: isFullClose
        ? 0
        : remainingBaseValue - remainingCost + remainingExtra,

      priceAtClose: currentPrice,
    });

    if (!position.history) {
      position.history = [];
    }

    position.history.push({
      action: isFullClose ? "close" : "remove",
      quantity: quantityToClose,
      amount: principalToClose,
      positionAmount: baseValueToClose,
      marginDebt: debtToClose,
      price: currentPrice,
      extra: extraToClose,
      profitLoss: realizedProfit,
      timestamp: now,
    });

    await position.save({ session });

    // Credit only net proceeds after repaying the closed portion's debt.
    userWallet.balance.available = currentAvailable + netWalletCredit;

    // Retain your existing convention: balance.total tracks realized P/L.
    userWallet.balance.total = currentTotal + realizedProfit;

    await userWallet.save({ session });

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
        positionCost: costToClose,
        marginDebt: debtToClose,
        leverage: 1,
        type: "position_close",
      },

      targets: {
        takeProfit: null,
        stopLoss: null,
        entryPoint: averageEntryPrice > 0 ? averageEntryPrice : currentPrice,
        exitPoint: currentPrice,
      },

      performance: {
        currentBaseValue: baseValueToClose,
        currentValue: totalProceeds,
        totalReturn: realizedProfit,

        totalReturnPercent: calculateReturnPercent({
          profit: realizedProfit,
          principal: principalToClose,
        }),

        todayReturn: 0,
        todayReturnPercent: 0,
        currentPrice,
      },

      status: "closed",
      closedAt: now,
      closeReason: "user_sell",
      extra: extraToClose,
      fullname: position.fullname,
    };

    const [sellTrade] = await Trade.create([sellTradeRecord], {
      session,
    });

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
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error(error);

    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(
      error.message || "Failed to sell position",
      error.statusCode || 500,
    );
  } finally {
    await session.endSession();
  }
}

const closeTrade = async ({ userId, tradeId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(tradeId)
    ) {
      throw new CustomError("Invalid user or trade ID.", 400);
    }

    validateTradeIdentifiers({ userId, tradeId });

    const user = await User.findById(userId)
      .session(session)
      .select("personalInfo contactInfo");

    const trade = await Trade.findById(tradeId).session(session);

    if (trade.orderType !== "buy") {
      throw new CustomError("Only buy trades can be closed.", 400);
    }

    if (trade.status !== "open") {
      throw new CustomError("This trade is already closed.", 400);
    }

    const position = await Position.findOne({
      userId,
      tradeIds: trade._id,
    }).session(session);

    if (!position) {
      throw new CustomError("Parent position not found.", 404);
    }

    if (position.status !== "open") {
      throw new CustomError("Parent position is not open.", 400);
    }

    // 4. Find the asset and its current market price.
    const asset = await Asset.findById(trade.asset.assetId).session(session);

    if (!asset) {
      throw new CustomError("Asset not found.", 404);
    }

    let currentPrice;

    try {
      currentPrice = validateMarketPrice(asset.priceData.current);
    } catch {
      throw new CustomError("Invalid market price to close trade.", 400);
    }

    const quantity = requireFiniteNumber(
      trade.execution?.quantity,
      "Trade quantity",
    );

    const principal = requireFiniteNumber(
      trade.execution?.amount,
      "Trade principal",
    );

    const positionCost = requireFiniteNumber(
      trade.execution?.positionAmount ??
        trade.execution?.positionCost ??
        principal,
      "Trade position cost",
    );

    const marginDebt = requireFiniteNumber(
      trade.execution?.marginDebt ?? 0,
      "Trade margin debt",
    );

    const extra = requireFiniteNumber(trade.extra ?? 0, "Trade extra");

    if (
      quantity <= 0 ||
      principal < 0 ||
      positionCost < 0 ||
      marginDebt < 0 ||
      extra < 0
    ) {
      throw new CustomError("Invalid trade accounting values.", 400);
    }

    const baseValue = calculateMarketValue(quantity, currentPrice);

    const closing = calculatePartialClose({
      quantity,
      principal,
      positionCost,
      marginDebt,
      baseValue,
      extra,
      closeRatio: 1,
    });

    const proceeds = requireFiniteNumber(
      closing.totalProceeds,
      "Close proceeds",
    );

    const realizedProfit = requireFiniteNumber(
      closing.realizedProfit,
      "Realized profit",
    );

    if (proceeds < 0) {
      throw new CustomError("Invalid trade proceeds.", 400);
    }

    const wallet = await Wallet.findOne({
      userId,
      name: position.wallet.name,
    }).session(session);

    if (!wallet) {
      throw new CustomError("Wallet not found.", 404);
    }

    const availableBalance = requireFiniteNumber(
      wallet.balance.available,
      "Wallet available balance",
    );

    const totalBalance = requireFiniteNumber(
      wallet.balance.total,
      "Wallet total balance",
    );

    trade.status = "closed";
    trade.closedAt = new Date();

    trade.performance = {
      ...(trade.performance?.toObject?.() ?? trade.performance ?? {}),
      currentPrice,
      currentBaseValue: baseValue,
      currentValue: proceeds,
      totalReturn: realizedProfit,
      totalReturnPercent:
        principal > 0 ? (realizedProfit / principal) * 100 : 0,
    };

    trade.markModified("performance");

    await trade.save({ session });

    const [sellTrade] = await Trade.create(
      [
        {
          userId,
          asset: trade.asset,
          wallet: trade.wallet,
          positionId: position._id,
          orderType: "sell",
          status: "closed",
          closedAt: new Date(),

          execution: {
            price: currentPrice,
            quantity,
            amount: principal,
            positionAmount: positionCost,
            positionCost,
            marginDebt,
            leverage: trade.execution?.leverage ?? 1,
            type: trade.execution?.type,
            closeRatio: 1,
            proceeds,
          },

          extra,
          performance: {
            currentPrice,
            currentBaseValue: baseValue,
            currentValue: proceeds,
            totalReturn: realizedProfit,
            totalReturnPercent:
              principal > 0 ? (realizedProfit / principal) * 100 : 0,
          },
          fullname: trade.fullname,
          assetType: trade.assetType,
          tradeIds: [trade._id],
        },
      ],
      { session },
    );

    // 10. Credit proceeds exactly once.
    wallet.balance.available = availableBalance + proceeds;
    wallet.balance.total = totalBalance + realizedProfit;

    await wallet.save({ session });

    // 11. Rebuild the parent position from its remaining open buy trades.
    const remainingTrades = await Trade.find({
      _id: { $in: position.tradeIds },
      userId,
      orderType: "buy",
      status: "open",
    }).session(session);

    const totals = calculatePositionTotals(remainingTrades);

    const noExposure = hasNoRemainingExposure(totals);

    if (noExposure) {
      position.status = "closed";
      position.closedAt = new Date();

      // Preserve the trade history but clear the aggregate exposure.
      position.quantity = 0;
      position.amountInvested = 0;
      position.positionCost = 0;
      position.marginDebt = 0;
      position.extra = 0;
      position.currentValue = 0;
      position.totalReturn = 0;
      position.totalReturnPercent = 0;
    } else {
      position.status = "open";
      position.quantity = totals.quantity;
      position.amountInvested = totals.principal;
      position.positionCost = totals.positionCost;
      position.marginDebt = totals.marginDebt;
      position.extra = totals.extra;
      position.currentValue = totals.currentValue;
      position.totalReturn = totals.totalReturn;
      position.totalReturnPercent = totals.totalReturnPercent;
    }

    await position.save({ session });

    // 12. Commit all database changes.
    await session.commitTransaction();

    return {
      success: true,
      message: "Trade closed successfully.",
      trade: sellTrade,
      user: user,
    };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("closeTrade error:", error);

    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message || "Failed to close trade.", 500);
  } finally {
    await session.endSession();
  }
};

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
  closeTrade,
};
