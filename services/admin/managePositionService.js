const { default: mongoose } = require("mongoose");
const Position = require("../../models/Position");
const { CustomError } = require("../../utils/utils");
const portfolioService = require("../user/portfolioService");
const Wallet = require("../../models/Wallet");
const Asset = require("../../models/Asset");
const Trade = require("../../models/Trade");
const positionService = require("../user/positionService");

class ManagePositionService {
  async fetchAllPositions() {
    const positions = await Position.find().lean();
    return positions;
  }

  async fetchPositionInfo(positionId) {
    if (!positionId) throw new CustomError("Position ID required!", 400);

    const position = await Position.findById(positionId);
    if (!position) throw new CustomError("Position not found!", 404);
    return position;
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

  async editPositionData(positionData) {
    const { positionId, customDate, extra } = positionData;

    // console.log(positionData);

    if (!positionId) throw new CustomError("Position ID required!", 400);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const position = await Position.findById(positionId).session(session);
      if (!position) throw new CustomError("Position not found!", 404);

      if (customDate !== undefined) {
        position.customDate = customDate;
      }

      if (extra !== undefined && extra !== null && extra !== "") {
        const parsedExtra = parseFloat(extra);

        if (isNaN(parsedExtra)) {
          throw new CustomError("Extra P&L must be a valid number", 400);
        }

        const trades = await Trade.find({
          _id: { $in: position.tradeIds },
        }).session(session);

        if (trades.length === 0) {
          position.performance.extra = parsedExtra;
        } else {
          const totalInvested = trades.reduce(
            (sum, trade) => sum + (trade.amount || 0),
            0,
          );

          if (totalInvested === 0) {
            trades.forEach((trade) => {
              trade.extra = parsedExtra / trades.length;
            });
          } else {
            trades.forEach((trade) => {
              const proportion = (trade.amount || 0) / totalInvested;
              trade.extra = parsedExtra * proportion;
            });
          }

          await Promise.all(trades.map((trade) => trade.save({ session })));

          position.performance.extra = parsedExtra;
        }
      }

      await position.save({ session });

      await session.commitTransaction();

      return position;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async deletePosition(positionId) {
    const deletedPosition = await Position.findByIdAndDelete(positionId);
    if (!deletedPosition) throw new CustomError("Position not found!", 404);

    if (deletedPosition.tradeIds && deletedPosition.tradeIds.length > 0) {
      await Trade.deleteMany({ _id: { $in: deletedPosition.tradeIds } });
    }

    return true;
  }
}

module.exports = new ManagePositionService();
