// trade.service.js
const mongoose = require("mongoose");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const TradeHelpers = require("./manageTradeHelper");
const portfolioService = require("../user/portfolioService");
const { CustomError } = require("../../utils/utils");
const Asset = require("../../models/Asset");
const Position = require("../../models/Position");
const positionService = require("../user/positionService");

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

        plan.balance.total -= marginAmount;
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

      const position = await TradeHelpers.updatePositionOnBuy(trade, session);

      await session.commitTransaction();

      portfolioService
        .updatePortfolioValue(
          trade.userId,
          -trade.execution.amount,
          "trade_buy",
          {
            transactionId: trade._id,
            assetSymbol: trade.asset.symbol,
            tradeAmount: trade.execution.amount,
            quantity: trade.execution.quantity,
            pricePerUnit: currentPrice,
          },
        )
        .catch((err) => console.error("Portfolio update failed:", err));

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

  async closePosition(formData) {
    const { positionId, amount } = formData;

    if (!positionId) {
      throw new CustomError("Invalid position! positionId is required", 400);
    }

    if (!amount) {
      throw new CustomError("amount is required", 400);
    }

    let closeRatio;
    let closePercentage;
    let closeAmount;

    if (amount) {
      closeAmount = parseFloat(amount);
      if (isNaN(closeAmount) || closeAmount <= 0) {
        throw new CustomError("Invalid amount! Must be a positive number", 400);
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const position = await Position.findById(positionId).session(session);
      if (!position) throw new CustomError("Position not found!", 404);
      if (position.status === "closed")
        throw new CustomError("Position is already closed!", 400);

      const wallet = await Wallet.findById(position.wallet.id).session(session);
      if (!wallet) throw new CustomError("Invalid wallet!", 404);

      const asset = await Asset.findById(position.asset.assetId).session(
        session,
      );
      if (!asset) throw new CustomError("Asset not found!", 404);

      const currentPrice = asset.priceData.current;

      const positionBaseValue = position.quantity * currentPrice;
      const positionExtra = position.performance.extra || 0;
      const totalPositionValue = positionBaseValue + positionExtra;

      if (amount) {
        closeRatio = closeAmount / totalPositionValue;
        if (closeRatio >= 0.9999) closeRatio = 1;
        if (closeRatio < 0.0001 && closeAmount > 0) closeRatio = 0.0001;
        closePercentage = closeRatio * 100;
      } else {
        closeRatio = closePercentage / 100;
        closeAmount = totalPositionValue * closeRatio;
      }

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

      wallet.balance.available += totalValueToClose;

      if (totalProfitLoss > 0) {
        wallet.balance.total += totalProfitLoss;
        wallet.balance.available += totalProfitLoss;
      } else if (totalProfitLoss < 0) {
        const loss = Math.abs(totalProfitLoss);
        wallet.balance.total -= loss;
        wallet.balance.available -= loss;
        if (wallet.balance.available < 0) wallet.balance.available = 0;
      }

      if (wallet.balance.total < 0) wallet.balance.total = 0;
      if (wallet.balance.available < 0) wallet.balance.available = 0;
      await wallet.save({ session });

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
        userId: position.userId,
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
        closeReason: "admin_close",
        extra: extraToClose,
        fullname: position.fullname,
        positionId: position._id,
        closedTradesIds: closedTrades.map((t) => t._id),
      };

      const sellTrade = await Trade.create([sellTradeRecord], { session });

      const sellTradeForPosition = {
        _id: sellTrade[0]._id,
        userId: position.userId,
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

      await session.commitTransaction();

      portfolioService
        .updatePortfolioValue(position.userId, totalProfitLoss, "trade_sell", {
          transactionId: sellTrade[0]._id,
          positionId: position._id,
          assetSymbol: position.asset.symbol,
          tradeAmount: totalProfitLoss,
          quantity: quantityToClose,
          pricePerUnit: currentPrice,
        })
        .catch((err) => console.error("Portfolio update failed:", err));

      session.endSession();

      return {
        success: true,
        position: updatedPosition,
        sellTrade: sellTrade[0],
      };
    } catch (error) {
      console.log(error);
      await session.abortTransaction();
      session.endSession();
      throw new CustomError(error.message, 500);
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
