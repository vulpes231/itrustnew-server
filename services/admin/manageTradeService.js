// trade.service.js
const { default: mongoose } = require("mongoose");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const Asset = require("../../models/Asset");
const Position = require("../../models/Position");
const positionService = require("../user/positionService");
const walletSnapshotService = require("../user/walletSnapshotService");
const portfolioService = require("../user/portfolioService");

class TradeService {
  constructor() {
    if (TradeService.instance) {
      return TradeService.instance;
    }
    TradeService.instance = this;
  }

  async createBuyTrade(tradeData) {
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
      extra,
      customDate,
    } = tradeData;

    if (!userId || !assetId || !walletId || !amount || !orderType) {
      throw new CustomError("Fill in the required field!", 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new CustomError("Invalid request!", 404);

      const wallet = await Wallet.findById(walletId).session(session);
      if (!wallet) throw new CustomError("Invalid wallet!", 404);

      const asset = await Asset.findById(assetId).session(session);
      if (!asset) throw new CustomError("Asset not found!", 404);

      const parsedAmt = Number(amount);
      const parsedLeverage =
        leverage === undefined || leverage === null || leverage === ""
          ? 1
          : Number(leverage);
      const parsedExtra = Number(extra ?? 0);

      if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
        throw new CustomError("Invalid investment amount!", 400);
      }

      if (!Number.isFinite(parsedExtra) || parsedExtra < 0) {
        throw new CustomError("Invalid bonus amount!", 400);
      }

      if (
        executionType === "leverage" &&
        (!Number.isFinite(parsedLeverage) ||
          parsedLeverage < 1 ||
          parsedLeverage > 10)
      ) {
        throw new CustomError(
          "Invalid leverage amount! Must be between 1 and 10",
          400,
        );
      }

      const leverageMultiplier =
        executionType === "leverage" ? parsedLeverage : 1;

      const positionAmount = parsedAmt * leverageMultiplier;
      const marginAmount = parsedAmt;
      const marginDebt = positionAmount - marginAmount;

      // Bonus is leverage-adjusted exactly once.
      const positionExtra = parsedExtra * leverageMultiplier;

      const currentPrice = Number(asset.priceData.current);

      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        throw new CustomError("Invalid asset price!", 400);
      }

      const quantity = positionAmount / currentPrice;

      if (wallet.balance.available < marginAmount) {
        throw new CustomError("Insufficient funds!", 400);
      }

      let plan;

      if (wallet.slug === "auto" && planId) {
        plan = user.activePlans.find(
          (plan) =>
            plan.planId.toString() === planId && plan.status === "active",
        );

        if (!plan) throw new CustomError("Plan not found!", 404);

        if (plan.balance.available < marginAmount) {
          throw new CustomError("Plan balance not sufficient!", 400);
        }

        plan.balance.available -= marginAmount;
        await user.save({ session });
      } else {
        wallet.balance.available -= marginAmount;
        await wallet.save({ session });
      }

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
          slug: wallet.slug,
        },
        plan: {
          id: plan?._id || null,
          name: plan?.name,
        },
        execution: {
          price: currentPrice,
          quantity,
          amount: marginAmount,
          positionAmount,
          positionCost: positionAmount,
          marginDebt,
          leverage: leverageMultiplier,
          interval: interval || null,
          type: executionType,
        },
        targets: {
          takeProfit: tp || null,
          stopLoss: sl || null,
          entryPoint: entry || null,
          exitPoint: exit || null,
        },
        customDate: customDate,

        performance: {
          // Original leveraged amount committed to the trade.
          currentBaseValue: positionAmount,

          // At entry, there is no market gain or loss.
          // Current value includes the bonus.
          currentValue: positionAmount + positionExtra,

          currentPrice,

          // Only the bonus counts as initial return.
          // Margin debt is NOT profit.
          totalReturn: positionExtra,

          totalReturnPercent:
            marginAmount > 0 ? (positionExtra / marginAmount) * 100 : 0,

          todayMarketReturn: 0,
          todayExtra: 0,
          todayReturn: 0,
          todayReturnPercent: 0,

          todayStartValue: positionAmount,
          todayStartDate: new Date(),
        },

        extra: positionExtra || 0,
        status: "open",
        fullname: user.fullName,
      };

      const createdTrade = await Trade.create([newTrade], { session });
      const trade = createdTrade[0];

      const buyTradeForPosition = {
        _id: createdTrade[0]._id,
        userId: trade.userId,
        asset: trade.asset,
        orderType: "buy",
        execution: {
          quantity: trade.execution.quantity,
          amount: trade.execution.amount,
          positionAmount: trade.execution.positionAmount,
          positionCost: trade.execution.positionCost,
          marginDebt: trade.execution.marginDebt,
          price: trade.execution.price,
        },
        wallet: trade.wallet,
        planId: trade.planId,
        fullname: trade.fullname,
        assetType: trade.assetType,
        extra: trade.extra,
      };

      const position = await positionService.updatePosition(
        buyTradeForPosition,
        session,
      );

      await portfolioService.createPortfolioSnapshot(
        trade.userId,
        "trade_buy",
        {
          tradeId: trade._id,
          assetSymbol: trade.asset.symbol,
        },
        session,
      );

      await walletSnapshotService.createWalletSnapshot(
        trade.wallet.id,
        "trade_buy",
        {
          tradeId: trade._id,
          assetSymbol: trade.asset.symbol,
        },
        session,
      );

      await session.commitTransaction();

      return {
        success: true,
        trade: trade,
        position: position,
        email: user.contactInfo.email,
      };
    } catch (error) {
      console.log(error);
      await session.abortTransaction();

      throw new CustomError(error.message, error.statusCode);
    } finally {
      await session.endSession();
    }
  }

  async closeTradeOrder(formData) {
    const { tradeId, closeAmount } = formData;

    const session = await mongoose.startSession();
    let transactionCommitted = false;

    try {
      let originalTrade;
      let sellTrade;
      let updatedPosition;
      let closeResult;

      session.startTransaction();

      const trade = await Trade.findById(tradeId).session(session);

      if (!trade) {
        throw new CustomError("Trade not found!", 404);
      }

      if (trade.status === "closed") {
        throw new CustomError("Trade already closed!", 400);
      }

      if (trade.orderType !== "buy") {
        throw new CustomError("Only buy trades can be closed!", 400);
      }

      const position = await Position.findOne({
        tradeIds: trade._id,
        userId: trade.userId,
        "asset.assetId": trade.asset.assetId,
        "wallet.id": trade.wallet.id,
        status: "open",
      }).session(session);

      if (!position) {
        throw new CustomError("Open position not found for this trade!", 404);
      }

      const asset = await Asset.findById(trade.asset.assetId).session(session);

      if (!asset) {
        throw new CustomError("Asset not found!", 404);
      }

      const wallet = await Wallet.findById(trade.wallet.id).session(session);

      if (!wallet) {
        throw new CustomError("Wallet not found!", 404);
      }

      // --------------------------------------------------
      // 1. Read and validate the current trade values
      // --------------------------------------------------

      const currentPrice = Number(asset.priceData?.current);
      const quantity = Number(trade.execution.quantity);
      const capital = Number(trade.execution.amount);

      const positionCost = Number(
        trade.execution.positionCost ??
          trade.execution.positionAmount ??
          capital,
      );

      const marginDebt = Number(
        trade.execution.marginDebt ?? Math.max(0, positionCost - capital),
      );

      const extra = Number(trade.extra) || 0;

      if (
        !Number.isFinite(currentPrice) ||
        currentPrice <= 0 ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(capital) ||
        capital <= 0 ||
        !Number.isFinite(positionCost) ||
        positionCost < 0 ||
        !Number.isFinite(marginDebt) ||
        marginDebt < 0 ||
        !Number.isFinite(extra) ||
        extra < 0
      ) {
        throw new CustomError(
          "Invalid trade values. Cannot close this trade!",
          400,
        );
      }

      // Current market value excludes bonus.
      // Use the live price to avoid closing at a stale valuation.
      const currentBaseValue = quantity * currentPrice;

      // The displayed/gross trade value includes bonus.
      const currentTradeValue = currentBaseValue + extra;

      if (!Number.isFinite(currentTradeValue) || currentTradeValue <= 0) {
        throw new CustomError("Invalid current trade value!", 400);
      }

      // --------------------------------------------------
      // 2. Calculate the portion being closed
      // --------------------------------------------------

      let closeRatio = 1;

      if (
        closeAmount !== undefined &&
        closeAmount !== null &&
        closeAmount !== ""
      ) {
        const requestedCloseAmount = Number(closeAmount);

        if (
          !Number.isFinite(requestedCloseAmount) ||
          requestedCloseAmount <= 0
        ) {
          throw new CustomError("Invalid close amount!", 400);
        }

        closeRatio = Math.min(requestedCloseAmount / currentTradeValue, 1);
      }

      if (closeRatio >= 0.999999) {
        closeRatio = 1;
      }

      const isFullClose = closeRatio === 1;
      const remainingRatio = 1 - closeRatio;

      const quantityToClose = quantity * closeRatio;
      const capitalToClose = capital * closeRatio;
      const positionCostToClose = positionCost * closeRatio;
      const marginDebtToClose = marginDebt * closeRatio;
      const marketValueToClose = currentBaseValue * closeRatio;
      const extraToClose = extra * closeRatio;

      // Realized P/L is market P/L plus the allocated bonus.
      const tradeProfitLoss =
        marketValueToClose - positionCostToClose + extraToClose;

      const closedAt = new Date();

      // --------------------------------------------------
      // 3. Settle wallet balances
      // --------------------------------------------------

      const walletCredit = marketValueToClose - marginDebtToClose;

      if (!Number.isFinite(walletCredit)) {
        throw new CustomError("Invalid wallet settlement!", 400);
      }

      wallet.balance.available =
        Number(wallet.balance.available || 0) + walletCredit;

      wallet.balance.total =
        Number(wallet.balance.total || 0) + tradeProfitLoss;

      await wallet.save({ session });

      // --------------------------------------------------
      // 4. Update the original buy trade
      // --------------------------------------------------

      if (isFullClose) {
        trade.status = "closed";
        trade.closedAt = closedAt;

        // Keep the original execution values as the historical
        // entry record. Store the final close results in performance.
        trade.performance.currentBaseValue = marketValueToClose;
        trade.performance.currentValue = marketValueToClose + extraToClose;
        trade.performance.currentPrice = currentPrice;
        trade.performance.totalReturn = tradeProfitLoss;

        trade.performance.totalReturnPercent =
          capitalToClose > 0 ? (tradeProfitLoss / capitalToClose) * 100 : 0;
      } else {
        // Reduce only the remaining values of this buy trade.
        trade.execution.amount = capital * remainingRatio;
        trade.execution.quantity = quantity * remainingRatio;

        trade.execution.positionAmount =
          Number(trade.execution.positionAmount ?? positionCost) *
          remainingRatio;

        trade.execution.positionCost = positionCost * remainingRatio;

        trade.execution.marginDebt = marginDebt * remainingRatio;

        trade.performance.currentBaseValue = currentBaseValue * remainingRatio;

        trade.extra = extra * remainingRatio;

        trade.performance.currentValue =
          trade.performance.currentBaseValue + trade.extra;

        trade.performance.currentPrice = currentPrice;

        trade.performance.totalReturn =
          trade.performance.currentBaseValue -
          trade.execution.positionCost +
          trade.extra;

        trade.performance.totalReturnPercent =
          trade.execution.amount > 0
            ? (trade.performance.totalReturn / trade.execution.amount) * 100
            : 0;

        if (!trade.partialCloses) {
          trade.partialCloses = [];
        }

        // Use only fields supported by your Trade partialCloses schema.
        trade.partialCloses.push({
          percentClosed: closeRatio * 100,
          principalClosed: capitalToClose,
          profitLossClosed: tradeProfitLoss,
          closedAt,
          remainingPrincipal: trade.execution.amount,
          remainingProfitLoss: trade.performance.totalReturn,
        });
      }

      await trade.save({ session });

      // --------------------------------------------------
      // 5. Create the separate sell transaction record
      // --------------------------------------------------

      const sellTradeRecord = {
        userId: trade.userId,
        asset: trade.asset,
        planId: trade.planId,
        assetType: trade.assetType,
        orderType: "sell",
        wallet: trade.wallet,
        plan: trade.plan,
        execution: {
          price: currentPrice,
          quantity: quantityToClose,
          amount: capitalToClose,
          positionAmount: marketValueToClose,
          positionCost: positionCostToClose,
          marginDebt: marginDebtToClose,
          leverage: trade.execution.leverage || 1,
          type: trade.execution.type,
          interval: trade.execution.interval,
        },
        targets: {
          takeProfit: null,
          stopLoss: null,
          entryPoint: trade.execution.price,
          exitPoint: currentPrice,
        },
        performance: {
          currentBaseValue: marketValueToClose,
          currentValue: marketValueToClose + extraToClose,
          currentPrice,
          totalReturn: tradeProfitLoss,
          totalReturnPercent:
            capitalToClose > 0 ? (tradeProfitLoss / capitalToClose) * 100 : 0,
          todayReturn: 0,
          todayReturnPercent: 0,
        },
        status: "closed",
        closedAt,
        closeReason: "trade_close",
        extra: extraToClose,
        fullname: trade.fullname,
        positionId: position._id,
        originalTradeId: trade._id,
      };

      const createdSellTrades = await Trade.create([sellTradeRecord], {
        session,
      });

      sellTrade = createdSellTrades[0];

      // --------------------------------------------------
      // 6. Update only the closed portion of the aggregate Position
      // --------------------------------------------------

      updatedPosition = await positionService.updatePosition(
        {
          ...sellTradeRecord,
          _id: sellTrade._id,
        },
        session,
      );

      // --------------------------------------------------
      // 7. Commit the financial transaction
      // --------------------------------------------------

      await session.commitTransaction();
      transactionCommitted = true;

      originalTrade = trade;

      closeResult = {
        success: true,
        originalTrade,
        sellTrade,
        position: updatedPosition,
        isFullClose,
        profitLoss: tradeProfitLoss,
        closedAmount: marketValueToClose + extraToClose,
        marketValueClosed: marketValueToClose,
        capitalClosed: capitalToClose,
        positionCostClosed: positionCostToClose,
        marginDebtClosed: marginDebtToClose,
        extraClosed: extraToClose,
      };

      // --------------------------------------------------
      // 8. Snapshots run AFTER commit.
      // Snapshot failures must NOT roll back or fail the close.
      // --------------------------------------------------

      try {
        await portfolioService.createPortfolioSnapshot(
          trade.userId,
          "trade_sell",
          {
            tradeId: trade._id,
            sellTradeId: sellTrade._id,
            assetSymbol: trade.asset.symbol,
          },
        );
      } catch (snapshotError) {
        console.error(
          "Portfolio snapshot failed after trade close:",
          snapshotError,
        );
      }

      try {
        await walletSnapshotService.createWalletSnapshot(
          trade.wallet.id,
          "trade_sell",
          {
            tradeId: trade._id,
            sellTradeId: sellTrade._id,
            assetSymbol: trade.asset.symbol,
          },
        );
      } catch (snapshotError) {
        console.error(
          "Wallet snapshot failed after trade close:",
          snapshotError,
        );
      }

      return closeResult;
    } catch (error) {
      // Never attempt to roll back a transaction that has committed.
      if (!transactionCommitted && session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error("Failed to abort close transaction:", abortError);
        }
      }

      console.error("Close trade order error:", error);

      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(
        error.message || "Failed to close trade",
        error.statusCode || 500,
      );
    } finally {
      await session.endSession();
    }
  }

  async getTradeById(tradeId) {
    const trade = await Trade.findById(tradeId);
    if (!trade) throw new CustomError("Trade not found!", 404);
    return trade;
  }

  async editTrade(formData) {
    const { tradeId, customDate, leverage } = formData;

    const session = await mongoose.startSession();

    try {
      let updatedTrade;

      await session.withTransaction(async () => {
        const trade = await Trade.findById(tradeId).session(session);

        if (!trade) {
          throw new CustomError("Trade not found!", 404);
        }

        if (trade.orderType !== "buy") {
          throw new CustomError(
            "Only buy trades can have their leverage resized!",
            400,
          );
        }

        const newLeverage = Number(leverage);
        const oldLeverage = Number(trade.execution.leverage) || 1;

        if (
          !Number.isFinite(newLeverage) ||
          newLeverage < 1 ||
          newLeverage > 10
        ) {
          throw new CustomError("Leverage must be between 1x and 10x!", 400);
        }

        const amount = Number(trade.execution.amount);
        const oldQuantity = Number(trade.execution.quantity);

        if (
          !Number.isFinite(amount) ||
          amount <= 0 ||
          !Number.isFinite(oldQuantity) ||
          oldQuantity <= 0
        ) {
          throw new CustomError("Invalid trade values!", 400);
        }

        const asset = await Asset.findById(trade.asset.assetId).session(
          session,
        );

        if (!asset) {
          throw new CustomError("Asset not found!", 404);
        }

        const entryPrice = Number(trade.execution.price);
        const currentPrice = Number(
          asset.priceData?.current ??
            trade.performance?.currentPrice ??
            entryPrice,
        );

        if (
          !Number.isFinite(entryPrice) ||
          entryPrice <= 0 ||
          !Number.isFinite(currentPrice) ||
          currentPrice <= 0
        ) {
          throw new CustomError("Invalid asset price!", 400);
        }

        // Original values for this trade only.
        const oldPositionCost = Number(
          trade.execution.positionCost ??
            trade.execution.positionAmount ??
            amount * oldLeverage,
        );

        const oldMarginDebt = Number(
          trade.execution.marginDebt ?? Math.max(0, oldPositionCost - amount),
        );

        const oldExtra = Number(trade.extra) || 0;

        // Find the aggregate position containing this trade.
        const position = await Position.findOne({
          userId: trade.userId,
          "asset.assetId": trade.asset.assetId,
          "wallet.id": trade.wallet.id,
          status: "open",
          tradeIds: trade._id,
        }).session(session);

        if (!position) {
          throw new CustomError(
            "Open position containing this trade was not found!",
            404,
          );
        }

        // Calculate the selected trade at the new leverage.
        const ratio = newLeverage / oldLeverage;
        const newPositionCost = amount * newLeverage;
        const newMarginDebt = Math.max(0, newPositionCost - amount);
        const newQuantity = newPositionCost / entryPrice;

        // Assumes the existing bonus was already leverage-adjusted.
        const newExtra = oldExtra * ratio;

        // Calculate how much this specific trade changes.
        const quantityDelta = newQuantity - oldQuantity;
        const costDelta = newPositionCost - oldPositionCost;
        const debtDelta = newMarginDebt - oldMarginDebt;

        const oldMarketValue = oldQuantity * currentPrice;
        const newMarketValue = newQuantity * currentPrice;
        const marketValueDelta = newMarketValue - oldMarketValue;
        const extraDelta = newExtra - oldExtra;

        // Update the selected trade's execution.
        trade.execution.type = "leverage";
        trade.execution.leverage = newLeverage;
        trade.execution.positionAmount = newPositionCost;
        trade.execution.positionCost = newPositionCost;
        trade.execution.marginDebt = newMarginDebt;
        trade.execution.quantity = newQuantity;

        // Recalculate this trade's current performance.
        trade.performance.currentBaseValue = newMarketValue;
        trade.performance.currentValue = newMarketValue + newExtra;
        trade.performance.currentPrice = currentPrice;
        trade.performance.totalReturn =
          newMarketValue - newPositionCost + newExtra;

        trade.performance.totalReturnPercent =
          amount > 0 ? (trade.performance.totalReturn / amount) * 100 : 0;

        trade.extra = newExtra;

        if (customDate) {
          trade.customDate = customDate;
        }

        // Update only the selected trade's contribution to the Position.
        position.quantity = Math.max(
          0,
          Number(position.quantity) + quantityDelta,
        );

        position.positionCost = Math.max(
          0,
          Number(position.positionCost ?? 0) + costDelta,
        );

        position.marginDebt = Math.max(
          0,
          Number(position.marginDebt ?? 0) + debtDelta,
        );

        position.performance.currentBaseValue = Math.max(
          0,
          Number(position.performance.currentBaseValue ?? 0) + marketValueDelta,
        );

        position.performance.extra = Math.max(
          0,
          Number(position.performance.extra ?? 0) + extraDelta,
        );

        position.performance.currentValue =
          position.performance.currentBaseValue + position.performance.extra;

        position.performance.currentPrice = currentPrice;

        position.averageEntryPrice =
          position.quantity > 0 ? position.positionCost / position.quantity : 0;

        position.performance.totalReturn =
          position.performance.currentBaseValue -
          position.positionCost +
          position.performance.extra;

        position.performance.totalReturnPercent =
          Number(position.amountInvested) > 0
            ? (position.performance.totalReturn /
                Number(position.amountInvested)) *
              100
            : 0;

        await trade.save({ session });
        await position.save({ session });

        updatedTrade = trade;
      });

      return updatedTrade;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(error.message, 500);
    } finally {
      await session.endSession();
    }
  }

  async deleteTradeOrder(tradeId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const trade = await Trade.findById(tradeId).session(session);
      if (!trade) throw new CustomError("Trade not found!", 404);

      const [user, tradeAcct] = await Promise.all([
        await User.findById(trade.userId).session(session),
        await Wallet.findById(trade.wallet.id).session(session),
      ]);

      if (!user) throw new CustomError("User not found!", 404);
      if (!tradeAcct) throw new CustomError("Wallet not found!", 404);

      const userPlans = user.activePlans;

      if (trade.planId) {
        const plan = userPlans.find((pl) => pl.planId === trade.planId);
        plan.balance.available += trade.execution.amount;
      } else {
        tradeAcct.balance.available += trade.execution.amount;
      }

      await user.save({ session });
      await tradeAcct.save({ session });

      const deletedTrade =
        await Trade.findByIdAndDelete(tradeId).session(session);
      if (!deletedTrade) throw new CustomError("Trade not found!", 404);

      await session.commitTransaction();
      session.endSession();

      return true;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getAllTrades(filters = {}) {
    const { status, assetType } = filters;
    const query = {};

    if (status) query.status = status;
    if (assetType) query.assetType = assetType;

    const trades = await Trade.find(query).sort({ createdAt: -1 });

    return {
      trades,
    };
  }

  async getUserTrades(userId, filters = {}) {
    const { status, assetType, limit = 50, skip = 0 } = filters;
    const query = { userId };

    if (status) query.status = status;
    if (assetType) query.assetType = assetType;

    const trades = await Trade.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Trade.countDocuments(query);

    return {
      trades,
      total,
      limit,
      skip,
      hasMore: skip + limit < total,
    };
  }

  async getTradeWithPosition(tradeId) {
    const trade = await this.getTradeById(tradeId);

    const Position = require("../models/Position");
    const position = await Position.findOne({
      userId: trade.userId,
      "asset.assetId": trade.asset.assetId,
      "wallet.id": trade.wallet.id,
    });

    return {
      trade,
      position,
      isPositionActive: position?.status === "open",
    };
  }
}

const tradeService = new TradeService();
module.exports = tradeService;
