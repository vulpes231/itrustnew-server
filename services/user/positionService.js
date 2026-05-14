const Position = require("../../models/Position");
const { CustomError } = require("../../utils/utils");
const mongoose = require("mongoose");

class PositionService {
  /**
   * Update position when a trade is created or closed
   * Now properly tracks quantity and average entry price
   */
  async updatePosition(trade, session = null) {
    const {
      userId,
      asset,
      orderType,
      execution,
      wallet,
      planId,
      fullname,
      assetType,
    } = trade;

    const query = {
      userId,
      "asset.assetId": asset.assetId,
      "wallet.id": wallet.id,
      status: "open",
    };

    let position = await Position.findOne(query).session(session);

    if (orderType === "buy") {
      const tradeQuantity = execution.quantity;
      const tradeAmount = execution.amount;
      const tradePrice = execution.price;

      if (position) {
        // Calculate new weighted average entry price
        const existingValue = position.amountInvested;
        const existingQuantity = position.quantity;
        const newTotalAmount = existingValue + tradeAmount;
        const newTotalQuantity = existingQuantity + tradeQuantity;
        const newAveragePrice = newTotalAmount / newTotalQuantity;
        const newCurrentValue =
          position.performance.currentValue + execution.positionAmount;

        // Update position
        position.amountInvested = newTotalAmount;
        position.quantity = newTotalQuantity;
        position.averageEntryPrice = newAveragePrice;
        position.performance.currentValue = newCurrentValue;
        position.performance.totalReturn = newCurrentValue - newTotalAmount;
        position.performance.totalReturnPercent =
          (position.performance.totalReturn / newTotalAmount) * 100;

        if (!position.tradeIds) position.tradeIds = [];
        position.tradeIds.push(trade._id);

        if (!position.history) position.history = [];
        position.history.push({
          action: "add",
          tradeId: trade._id,
          quantity: tradeQuantity,
          amount: tradeAmount,
          price: tradePrice,
          timestamp: new Date(),
        });

        await position.save({ session });
      } else {
        const positionData = {
          userId,
          asset: {
            assetId: asset.assetId,
            name: asset.name,
            symbol: asset.symbol,
            img: asset.img,
            type: assetType,
          },
          planId: planId || null,
          orderType: orderType,
          wallet: {
            id: wallet.id,
            name: wallet.name,
          },
          amountInvested: execution.amount,
          quantity: execution.quantity,
          averageEntryPrice: execution.price,
          performance: {
            currentValue: execution.positionAmount,
            totalReturn: 0,
            totalReturnPercent: 0,
            todayReturn: 0,
            todayReturnPercent: 0,
            extra: 0,
          },
          status: "open",
          fullname: fullname,
          partialCloses: [],
          tradeIds: [trade._id],
          history: [
            {
              action: "create",
              tradeId: trade._id,
              quantity: execution.quantity,
              amount: execution.amount,
              price: execution.price,
              timestamp: new Date(),
            },
          ],
        };

        const createdPosition = await Position.create([positionData], {
          session,
        });
        position = createdPosition[0];
      }
    } else if (orderType === "sell") {
      if (!position) {
        throw new CustomError("No open position found for this asset", 400);
      }

      const sellQuantity = execution.quantity;
      const sellAmount = execution.amount;
      const sellValue = execution.positionAmount;
      const profitLoss = sellValue - sellAmount;

      if (Math.abs(sellQuantity - position.quantity) < 0.000001) {
        position.status = "closed";
        position.performance.totalReturn = profitLoss;
        position.performance.totalReturnPercent =
          (profitLoss / position.amountInvested) * 100;
        position.performance.currentValue = 0;
        position.closedAt = new Date();

        position.history.push({
          action: "close",
          tradeId: trade._id,
          quantity: sellQuantity,
          amount: sellAmount,
          price: execution.price,
          timestamp: new Date(),
        });
      } else {
        const percentClosed = (sellQuantity / position.quantity) * 100;
        const remainingQuantity = position.quantity - sellQuantity;
        const remainingPrincipal = position.amountInvested - sellAmount;
        const remainingProfitLoss =
          position.performance.totalReturn - profitLoss;

        const newCurrentValue = position.performance.currentValue - sellValue;

        position.partialCloses.push({
          percentClosed: parseFloat(percentClosed.toFixed(2)),
          quantityClosed: sellQuantity,
          principalClosed: sellAmount,
          profitLossClosed: profitLoss,
          closedAt: new Date(),
          remainingQuantity: remainingQuantity,
          remainingPrincipal: remainingPrincipal,
          remainingProfitLoss: remainingProfitLoss,
          priceAtClose: execution.price,
        });

        position.quantity = remainingQuantity;
        position.amountInvested = remainingPrincipal;
        position.performance.currentValue = newCurrentValue;
        position.performance.totalReturn = remainingProfitLoss;
        position.performance.totalReturnPercent =
          (remainingProfitLoss / remainingPrincipal) * 100;

        position.history.push({
          action: "remove",
          tradeId: trade._id,
          quantity: sellQuantity,
          amount: sellAmount,
          price: execution.price,
          timestamp: new Date(),
        });
      }

      await position.save({ session });
    }

    return position;
  }

  async updatePositionPerformance(position, currentPrice) {
    const currentValue = position.quantity * currentPrice;
    const totalReturn = currentValue - position.amountInvested;
    const totalReturnPercent = (totalReturn / position.amountInvested) * 100;

    const previousValue = position.performance.currentValue || currentValue;
    const todayReturn = currentValue - previousValue;
    const todayReturnPercent =
      previousValue > 0 ? (todayReturn / previousValue) * 100 : 0;

    position.performance.currentValue = currentValue;
    position.performance.totalReturn = totalReturn;
    position.performance.totalReturnPercent = totalReturnPercent;
    position.performance.todayReturn = todayReturn;
    position.performance.todayReturnPercent = todayReturnPercent;

    await position.save();
    return position;
  }

  async updateUserPositionsPerformance(userId, assetPrices) {
    const positions = await Position.find({
      userId,
      status: "open",
    });

    const updates = [];
    for (const position of positions) {
      const currentPrice = assetPrices[position.asset.symbol];
      if (currentPrice) {
        updates.push(this.updatePositionPerformance(position, currentPrice));
      }
    }

    return Promise.all(updates);
  }

  async getUserPositionSummary(userId) {
    const positions = await Position.find({
      userId,
      status: "open",
    }).populate("asset.assetId");

    const summary = {
      totalInvested: 0,
      totalCurrentValue: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      totalQuantity: 0,
      positions: [],
    };

    for (const position of positions) {
      summary.totalInvested += position.amountInvested;
      summary.totalCurrentValue += position.performance.currentValue;
      summary.totalReturn += position.performance.totalReturn;
      summary.totalQuantity += position.quantity;

      summary.positions.push({
        asset: position.asset,
        quantity: position.quantity,
        averageEntryPrice: position.averageEntryPrice,
        amountInvested: position.amountInvested,
        currentValue: position.performance.currentValue,
        currentPrice: position.performance.currentValue / position.quantity,
        return: position.performance.totalReturn,
        returnPercent: position.performance.totalReturnPercent,
        todayReturn: position.performance.todayReturn,
        todayReturnPercent: position.performance.todayReturnPercent,
      });
    }

    if (summary.totalInvested > 0) {
      summary.totalReturnPercent =
        (summary.totalReturn / summary.totalInvested) * 100;
    }

    return summary;
  }

  async getUserPositionByAsset(userId, assetId, walletId) {
    const position = await Position.findOne({
      userId,
      "asset.assetId": assetId,
      "wallet.id": walletId,
      status: "open",
    });

    if (!position) return null;

    return {
      ...position.toObject(),
      currentAveragePrice: position.averageEntryPrice,
      currentValue: position.performance.currentValue,
      unrealizedPL: position.performance.totalReturn,
      unrealizedPLPercent: position.performance.totalReturnPercent,
    };
  }

  async getWalletPositions(walletId, userId) {
    const positions = await Position.find({
      userId,
      "wallet.id": walletId,
      status: "open",
    }).populate("asset.assetId");

    const summary = {
      totalInvested: 0,
      totalCurrentValue: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      positions: positions.map((p) => ({
        ...p.toObject(),
        currentAveragePrice: p.averageEntryPrice,
        unrealizedPL: p.performance.totalReturn,
        unrealizedPLPercent: p.performance.totalReturnPercent,
      })),
    };

    for (const position of positions) {
      summary.totalInvested += position.amountInvested;
      summary.totalCurrentValue += position.performance.currentValue;
      summary.totalReturn += position.performance.totalReturn;
    }

    if (summary.totalInvested > 0) {
      summary.totalReturnPercent =
        (summary.totalReturn / summary.totalInvested) * 100;
    }

    return summary;
  }

  async verifyPositionForSell(userId, assetId, walletId, sellQuantity) {
    const position = await Position.findOne({
      userId,
      "asset.assetId": assetId,
      "wallet.id": walletId,
      status: "open",
    });

    if (!position) {
      throw new CustomError("No open position found for this asset", 400);
    }

    if (sellQuantity > position.quantity) {
      throw new CustomError(
        `Cannot sell more than available. Available: ${position.quantity} units, Requested: ${sellQuantity} units`,
        400,
      );
    }

    return {
      position,
      availableQuantity: position.quantity,
      availableAmount: position.amountInvested,
      averagePrice: position.averageEntryPrice,
    };
  }

  async getPositionHistory(userId, assetId, walletId) {
    const position = await Position.findOne({
      userId,
      "asset.assetId": assetId,
      "wallet.id": walletId,
    }).populate("tradeIds");

    if (!position) {
      throw new CustomError("Position not found", 404);
    }

    return {
      position: {
        asset: position.asset,
        currentQuantity: position.quantity,
        averageEntryPrice: position.averageEntryPrice,
        totalInvested: position.amountInvested,
        currentValue: position.performance.currentValue,
      },
      history: position.history,
      trades: position.tradeIds,
      partialCloses: position.partialCloses,
    };
  }

  async getPositionValueAtTime(userId, assetId, walletId, timestamp) {
    const position = await Position.findOne({
      userId,
      "asset.assetId": assetId,
      "wallet.id": walletId,
      createdAt: { $lte: timestamp },
      $or: [{ status: "open" }, { closedAt: { $gte: timestamp } }],
    });

    if (!position) return null;

    const tradesUpToDate = position.tradeIds.filter(
      (trade) => trade.createdAt <= timestamp,
    );

    return {
      asset: position.asset,
      quantity: position.quantity,
      value: position.performance.currentValue,
    };
  }
}

module.exports = new PositionService();
