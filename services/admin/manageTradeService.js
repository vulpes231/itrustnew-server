// trade.service.js
const mongoose = require("mongoose");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const TradeHelpers = require("./manageTradeHelper");
const portfolioService = require("../user/portfolioService");
const { CustomError } = require("../../utils/utils");
const Asset = require("../../models/Asset");

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

      // Calculate leveraged position
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

      // Check wallet balance
      if (wallet.balance.available < marginAmount) {
        throw new CustomError("Insufficient funds!", 400);
      }

      // Update wallet
      wallet.balance.available -= marginAmount;
      await wallet.save({ session });

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
        performance: {
          currentValue: positionAmount,
          currentPrice: currentPrice,
          totalReturn: 0,
          totalReturnPercent: 0,
          todayReturn: 0,
          todayReturnPercent: 0,
        },
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
        wallet: {
          availableBalance: wallet.balance.available,
          totalBalance: wallet.balance.total,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw new CustomError(error.message, 500);
    }
  }

  async closeTrade(formData) {
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
      if (!trade) throw new CustomError("Invalid trade!", 404);
      if (trade.status === "closed")
        throw new CustomError("Trade is already closed!", 400);

      const wallet = await Wallet.findById(trade.wallet.id).session(session);
      if (!wallet) throw new CustomError("Invalid wallet!", 404);

      const asset = await Asset.findById(trade.asset.assetId).session(session);
      if (!asset) throw new CustomError("Asset not found!", 404);

      const currentPrice = asset.priceData.current;

      const calculations = TradeHelpers.calculateCloseValues(
        trade,
        currentPrice,
        parserPercent,
      );

      await TradeHelpers.updateWalletOnClose(wallet, calculations, session);

      const updatedTrade = await TradeHelpers.updateTradeOnClose(
        trade,
        calculations,
        parserPercent,
        session,
      );

      const updatedPosition = await TradeHelpers.updatePositionOnSell(
        trade,
        parserPercent,
        currentPrice,
        session,
      );

      await session.commitTransaction();

      portfolioService
        .updatePortfolioValue(
          trade.userId,
          calculations.profitLossToClose,
          "trade_sell",
          {
            transactionId: trade._id,
            assetSymbol: trade.asset.symbol,
            tradeAmount: calculations.profitLossToClose,
            quantity: trade.execution.quantity,
            pricePerUnit: currentPrice,
          },
        )
        .catch((err) => console.error("Portfolio update failed:", err));

      session.endSession();

      return {
        success: true,
        trade: updatedTrade,
        position: updatedPosition,
        closedPortion: {
          percentClosed: parserPercent,
          principalClosed: calculations.principalToClose,
          profitLossClosed: calculations.profitLossToClose,
          currentValueClosed: calculations.currentValueToClose,
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

  async getTradeById(tradeId) {
    const trade = await Trade.findById(tradeId);
    if (!trade) throw new CustomError("Trade not found!", 404);
    return trade;
  }

  async editTrade(tradeId) {
    const trade = await Trade.findById(tradeId);
    if (!trade) throw new CustomError("Trade not found!", 404);
    return trade;
  }

  async getAllTrades(filters = {}) {
    const { status, assetType, limit = 50, skip = 0, page } = filters;
    const query = {};

    if (status) query.status = status;
    if (assetType) query.assetType = assetType;

    const trades = await Trade.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Trade.countDocuments(query);

    return {
      trades,
      totalItems: total,
      totalPages,
      currentPage: page,
      hasMore: skip + limit < total,
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
