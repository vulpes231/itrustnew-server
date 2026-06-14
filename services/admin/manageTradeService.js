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
      const parsedAmt = parseFloat(amount);
      const parsedLeverage = leverage ? parseFloat(leverage) : 1;

      const user = await User.findById(userId).session(session);
      if (!user) throw new CustomError("Invalid request!", 404);

      const wallet = await Wallet.findById(walletId).session(session);
      if (!wallet) throw new CustomError("Invalid wallet!", 404);

      const asset = await Asset.findById(assetId).session(session);
      if (!asset) throw new CustomError("Asset not found!", 404);

      let marginAmount = parsedAmt;
      let positionAmount = parsedAmt;
      let leverageMultiplier = 1;

      if (executionType === "leverage" && parsedLeverage > 1) {
        if (parsedLeverage > 10 || parsedLeverage < 1) {
          throw new CustomError(
            "Invalid leverage amount! Must be between 1 and 10",
            400,
          );
        }
        leverageMultiplier = parsedLeverage;
        positionAmount = parsedAmt * leverageMultiplier;
        marginAmount = parsedAmt;
      }

      const currentPrice = asset.priceData.current;
      const quantity = positionAmount / currentPrice;

      if (wallet.balance.available < marginAmount) {
        throw new CustomError("Insufficient funds!", 400);
      }

      if (wallet.slug === "auto" && planId) {
        const plan = user.activePlans.find(
          (plan) => plan.planId.toString() === planId,
        );

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
        },
        execution: {
          price: currentPrice,
          quantity: quantity,
          amount: marginAmount,
          positionAmount: positionAmount,
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
          currentValue: positionAmount,
          currentPrice: currentPrice,
          totalReturn: 0,
          totalReturnPercent: 0,
          todayReturn: 0,
          todayReturnPercent: 0,
        },
        extra: extra || 0,
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
          price: currentPrice,
        },
        wallet: trade.wallet,
        planId: trade.planId,
        fullname: trade.fullname,
        assetType: trade.assetType,
        extra: extra,
      };

      const position = await positionService.updatePosition(
        buyTradeForPosition,
        session,
      );

      await session.commitTransaction();

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

      session.endSession();

      return {
        success: true,
        trade: trade,
        position: position,
        email: user.contactInfo.email,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw new CustomError(error.message, 500);
    }
  }

  async closeTradeOrder(formData) {
    const { tradeId, closeAmount } = formData;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const trade = await Trade.findById(tradeId).session(session);
      if (!trade) throw new CustomError("Trade not found!", 404);
      if (trade.status === "closed")
        throw new CustomError("Trade already closed!", 400);

      const position = await Position.findOne({
        tradeIds: trade._id,
        status: "open",
      }).session(session);

      if (!position)
        throw new CustomError("Position not found for this trade!", 404);

      const asset = await Asset.findById(trade.asset.assetId).session(session);
      if (!asset) throw new CustomError("Asset not found!", 404);

      const currentPrice = asset.priceData.current;
      const currentTradeValue =
        trade.performance.currentValue || trade.execution.positionAmount;

      let closeRatio;
      let isFullClose = false;

      if (closeAmount && closeAmount > 0) {
        if (Math.abs(closeAmount - currentTradeValue) < 0.001) {
          closeRatio = 1;
          isFullClose = true;
        } else if (closeAmount < currentTradeValue) {
          closeRatio = closeAmount / currentTradeValue;
          isFullClose = false;
        } else {
          console.warn(
            `Close amount (${closeAmount}) exceeds trade value (${currentTradeValue}), closing fully`,
          );
          closeRatio = 1;
          isFullClose = true;
        }
      } else {
        closeRatio = 1;
        isFullClose = true;
      }

      if (Math.abs(closeRatio - 1) < 0.0001) {
        closeRatio = 1;
        isFullClose = true;
      }

      const tradeValueToClose = currentTradeValue * closeRatio;
      const tradeAmountToClose = trade.execution.amount * closeRatio;
      const tradeProfitLoss = tradeValueToClose - tradeAmountToClose;
      const quantityToClose = trade.execution.quantity * closeRatio;
      const extraToClose = (trade.extra || 0) * closeRatio;

      const wallet = await Wallet.findById(trade.wallet.id).session(session);
      if (!wallet) throw new CustomError("Wallet not found!", 404);

      wallet.balance.available += tradeValueToClose;
      wallet.balance.total += tradeProfitLoss;
      if (wallet.balance.available < 0) wallet.balance.available = 0;
      if (wallet.balance.total < 0) wallet.balance.total = 0;
      await wallet.save({ session });

      if (isFullClose) {
        trade.status = "closed";
        trade.closedAt = new Date();
        trade.performance.currentValue = tradeValueToClose;
        trade.performance.totalReturn = tradeProfitLoss;
        trade.performance.totalReturnPercent =
          (tradeProfitLoss / trade.execution.amount) * 100;
      } else {
        const remainingRatio = 1 - closeRatio;

        trade.execution.amount = trade.execution.amount * remainingRatio;
        trade.execution.quantity = trade.execution.quantity * remainingRatio;
        trade.execution.positionAmount =
          trade.execution.positionAmount * remainingRatio;
        trade.performance.currentValue = currentTradeValue * remainingRatio;
        trade.performance.totalReturn =
          (trade.performance.totalReturn || 0) * remainingRatio;
        trade.extra = (trade.extra || 0) * remainingRatio;

        if (!trade.partialCloses) trade.partialCloses = [];
        trade.partialCloses.push({
          percentClosed: closeRatio * 100,
          principalClosed: tradeAmountToClose,
          profitLossClosed: tradeProfitLoss,
          extraClosed: extraToClose,
          closedAt: new Date(),
          remainingPrincipal: trade.execution.amount,
          remainingProfitLoss: trade.performance.totalReturn,
          priceAtClose: currentPrice,
        });
      }

      await trade.save({ session });

      const sellTradeRecord = {
        userId: trade.userId,
        asset: trade.asset,
        planId: trade.planId,
        assetType: trade.assetType,
        orderType: "sell",
        wallet: trade.wallet,
        execution: {
          price: currentPrice,
          quantity: quantityToClose,
          amount: tradeAmountToClose,
          positionAmount: tradeValueToClose,
          leverage: trade.execution.leverage || 1,
        },
        targets: {
          takeProfit: null,
          stopLoss: null,
          entryPoint: trade.execution.price,
          exitPoint: currentPrice,
        },
        performance: {
          currentValue: tradeValueToClose,
          totalReturn: tradeProfitLoss,
          totalReturnPercent: (tradeProfitLoss / tradeAmountToClose) * 100,
          todayReturn: 0,
          todayReturnPercent: 0,
          currentPrice: currentPrice,
        },
        status: "closed",
        closedAt: new Date(),
        closeReason: "trade_close",
        extra: extraToClose,
        fullname: trade.fullname,
        positionId: position._id,
        originalTradeId: trade._id,
      };

      const sellTrade = await Trade.create([sellTradeRecord], { session });

      const updatedPosition = await positionService.updatePosition(
        {
          ...sellTradeRecord,
          _id: sellTrade[0]._id,
        },
        session,
      );

      await session.commitTransaction();

      await portfolioService.createPortfolioSnapshot(
        trade.userId,
        "trade_sell",
        {
          tradeId: trade._id,
          assetSymbol: trade.asset.symbol,
        },
        session,
      );

      await walletSnapshotService.createWalletSnapshot(
        trade.wallet.id,
        "trade_sell",
        {
          tradeId: trade._id,
          assetSymbol: trade.asset.symbol,
        },
        session,
      );

      session.endSession();

      return {
        success: true,
        originalTrade: trade,
        sellTrade: sellTrade[0],
        position: updatedPosition,
        isFullClose,
        profitLoss: tradeProfitLoss,
        closedAmount: tradeValueToClose,
      };
    } catch (error) {
      console.error("Close trade order error:", error);
      await session.abortTransaction();
      session.endSession();
      throw new CustomError(
        error.message || "Failed to close trade",
        error.statusCode || 500,
      );
    }
  }

  async getTradeById(tradeId) {
    const trade = await Trade.findById(tradeId);
    if (!trade) throw new CustomError("Trade not found!", 404);
    return trade;
  }

  async editTrade(formData) {
    const { tradeId, customDate } = formData;
    const trade = await Trade.findById(tradeId);
    if (!trade) throw new CustomError("Trade not found!", 404);

    trade.customDate = customDate;
    await trade.save();
    return trade;
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
    const { status, assetType, limit = 15, skip = 0, page } = filters;
    const query = {};

    if (status) query.status = status;
    if (assetType) query.assetType = assetType;

    const trades = await Trade.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const totalTrades = await Asset.countDocuments(query);
    const totalPages = Math.ceil(totalTrades / limit);

    return {
      trades,
      totalItems: totalTrades,
      totalPages,
      currentPage: page,
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
