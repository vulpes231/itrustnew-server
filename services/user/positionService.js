const Position = require("../../models/Position");
const Trade = require("../../models/Trade");
const { CustomError } = require("../../utils/utils");
const mongoose = require("mongoose");

class PositionService {
  async redistributeTradeExtra(position, session) {
    const trades = await Trade.find({
      _id: { $in: position.tradeIds },
    }).session(session);

    if (!trades.length) return;

    const positionExtra = position.performance?.extra || 0;

    const totalAmount = trades.reduce(
      (sum, trade) => sum + (trade.execution?.amount || 0),
      0,
    );

    for (const trade of trades) {
      console.log("before", trade);
      let tradeExtra;

      if (totalAmount === 0) {
        tradeExtra = positionExtra / trades.length;
      } else {
        const tradeAmount = trade.execution?.amount || 0;

        tradeExtra = positionExtra * (tradeAmount / totalAmount);
      }

      const currentValueWithoutExtra =
        (trade.performance.currentValue || 0) - (trade.extra || 0);

      trade.extra = tradeExtra;

      trade.performance.currentValue = currentValueWithoutExtra + tradeExtra;

      console.log("after", trade);

      await trade.save({ session });
    }
  }

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
      extra,
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
      const tradeExtra = Number(extra || 0);

      // Pure market value of this trade (positionAmount should already be market value)
      const tradeMarketValue = Number(execution.positionAmount ?? tradeAmount);

      if (position) {
        // ---------- ADD TO EXISTING POSITION ----------
        const existingAmount = Number(position.amountInvested || 0);
        const existingQuantity = Number(position.quantity || 0);
        const existingExtra = Number(position.performance?.extra || 0);

        const newTotalAmount = existingAmount + tradeAmount;
        const newTotalQuantity = existingQuantity + tradeQuantity;
        const newAveragePrice =
          newTotalQuantity > 0 ? newTotalAmount / newTotalQuantity : 0;

        // Keep pure market value
        const existingBaseValue = Number(
          position.performance?.currentBaseValue || 0,
        );
        const newBaseValue = existingBaseValue + tradeMarketValue;

        // Position extra stays authoritative (we redistribute later)
        const newCurrentValue = newBaseValue + existingExtra;

        position.amountInvested = newTotalAmount;
        position.quantity = newTotalQuantity;
        position.averageEntryPrice = newAveragePrice;

        if (!position.performance) position.performance = {};

        position.performance.currentBaseValue = newBaseValue;
        position.performance.currentValue = newCurrentValue;
        position.performance.currentPrice = tradePrice; // or keep previous if you prefer
        position.performance.extra = existingExtra; // do NOT add tradeExtra here

        position.performance.totalReturn = newCurrentValue - newTotalAmount;
        position.performance.totalReturnPercent =
          newTotalAmount > 0
            ? (position.performance.totalReturn / newTotalAmount) * 100
            : 0;

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

        // Redistribute the (unchanged) position extra across all trades
        await this.redistributeTradeExtra(position, session);
      } else {
        // ---------- CREATE NEW POSITION ----------
        const currentBaseValue = tradeMarketValue;
        const currentValue = currentBaseValue + tradeExtra;

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
          orderType,
          wallet: {
            id: wallet.id,
            name: wallet.name,
          },
          amountInvested: tradeAmount,
          quantity: tradeQuantity,
          averageEntryPrice: tradePrice,
          performance: {
            // Pure market
            currentBaseValue: currentBaseValue,
            currentPrice: tradePrice,

            // Market + extra
            currentValue: currentValue,
            extra: tradeExtra,

            // Returns
            totalReturn: currentValue - tradeAmount, // normally just the extra
            totalReturnPercent:
              tradeAmount > 0
                ? ((currentValue - tradeAmount) / tradeAmount) * 100
                : 0,

            todayReturn: 0,
            todayReturnPercent: 0,
            todayMarketReturn: 0,
            todayExtra: 0,
            todayStartValue: currentBaseValue,
            todayStartDate: new Date(),
            previousClose: tradePrice,
          },
          status: "open",
          fullname,
          partialCloses: [],
          tradeIds: [trade._id],
          history: [
            {
              action: "create",
              tradeId: trade._id,
              quantity: tradeQuantity,
              amount: tradeAmount,
              price: tradePrice,
              extra: tradeExtra,
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
      // ---------- SELL (kept mostly as-is, only made consistent) ----------
      if (!position) {
        throw new CustomError("No open position found for this asset", 400);
      }

      if (!position.performance) position.performance = {};

      const sellQuantity = execution.quantity;
      const sellAmount = execution.amount;
      const sellMarketValue = Number(execution.positionAmount ?? sellAmount);
      const tradeExtra = Number(extra || 0);

      const profitLossFromBase = sellMarketValue - sellAmount;
      const totalProfitLoss = profitLossFromBase + tradeExtra;

      if (Math.abs(sellQuantity - position.quantity) < 0.000001) {
        // Full close
        position.status = "closed";
        position.performance.totalReturn = totalProfitLoss;
        position.performance.totalReturnPercent =
          position.amountInvested > 0
            ? (totalProfitLoss / position.amountInvested) * 100
            : 0;
        position.performance.currentValue = 0;
        position.performance.currentBaseValue = 0;
        position.performance.extra = 0;
        position.closedAt = new Date();

        position.history.push({
          action: "close",
          tradeId: trade._id,
          quantity: sellQuantity,
          amount: sellAmount,
          price: execution.price,
          extra: tradeExtra,
          timestamp: new Date(),
        });
      } else {
        // Partial close
        const closeRatio = sellQuantity / position.quantity;
        const extraToClose = (position.performance.extra || 0) * closeRatio;

        const percentClosed = (sellQuantity / position.quantity) * 100;
        const remainingQuantity = position.quantity - sellQuantity;
        const remainingPrincipal = position.amountInvested - sellAmount;
        const remainingExtra = (position.performance.extra || 0) - extraToClose;

        const newBaseValue =
          (position.performance.currentBaseValue || 0) - sellMarketValue;
        const newCurrentValue = newBaseValue + remainingExtra;
        const remainingProfitLoss = newCurrentValue - remainingPrincipal;

        position.partialCloses.push({
          percentClosed: parseFloat(percentClosed.toFixed(2)),
          quantityClosed: sellQuantity,
          principalClosed: sellAmount,
          profitLossClosed: totalProfitLoss,
          extraClosed: tradeExtra,
          closedAt: new Date(),
          remainingQuantity,
          remainingPrincipal,
          remainingProfitLoss,
          remainingExtra,
          priceAtClose: execution.price,
        });

        position.quantity = remainingQuantity;
        position.amountInvested = remainingPrincipal;

        position.performance.currentBaseValue = newBaseValue;
        position.performance.currentValue = newCurrentValue;
        position.performance.extra = remainingExtra;
        position.performance.totalReturn = remainingProfitLoss;
        position.performance.totalReturnPercent =
          remainingPrincipal > 0
            ? (remainingProfitLoss / remainingPrincipal) * 100
            : 0;

        position.history.push({
          action: "remove",
          tradeId: trade._id,
          quantity: sellQuantity,
          amount: sellAmount,
          price: execution.price,
          extra: tradeExtra,
          timestamp: new Date(),
        });
      }

      await position.save({ session });
    }

    return position;
  }

  async updatePositionPerformance(position, currentPrice) {
    // Current value from base position (quantity * price)
    const currentBaseValue = position.quantity * currentPrice;
    const currentExtra = position.performance.extra || 0;
    const currentValue = currentBaseValue + currentExtra;

    const totalReturn = currentValue - position.amountInvested;
    const totalReturnPercent =
      position.amountInvested > 0
        ? (totalReturn / position.amountInvested) * 100
        : 0;

    const previousValue = position.performance?.currentValue || currentValue;
    const todayReturn = currentValue - previousValue;
    const todayReturnPercent =
      previousValue > 0 ? (todayReturn / previousValue) * 100 : 0;

    position.performance.currentValue = currentBaseValue; // Store base value separately
    position.performance.totalReturn = totalReturn;
    position.performance.totalReturnPercent = totalReturnPercent;
    position.performance.todayReturn = todayReturn;
    position.performance.todayReturnPercent = todayReturnPercent;
    position.performance.currentPrice = currentPrice;

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
      totalExtra: 0,
      positions: [],
    };

    for (const position of positions) {
      // ---------- CORRECT MAPPING ----------
      const currentBaseValue = Number(
        position.performance?.currentBaseValue || 0,
      );
      const currentExtra = Number(position.performance?.extra || 0);

      // Prefer the already-stored currentValue (it should already be base + extra)
      // Fall back only if it is missing
      const currentValue =
        Number(position.performance?.currentValue) ||
        currentBaseValue + currentExtra;

      const amountInvested = Number(position.amountInvested || 0);
      const totalReturn = currentValue - amountInvested;

      // Prefer the stored currentPrice, fall back to calculation from pure base
      const currentPrice =
        Number(position.performance?.currentPrice) ||
        (position.quantity > 0 ? currentBaseValue / position.quantity : 0);

      // -------------------------------------

      summary.totalInvested += amountInvested;
      summary.totalCurrentValue += currentValue;
      summary.totalReturn += totalReturn;
      summary.totalQuantity += position.quantity || 0;
      summary.totalExtra += currentExtra;

      summary.positions.push({
        asset: position.asset,
        wallet: position.wallet,
        _id: position._id,
        orderType: position.orderType,
        status: position.status,
        quantity: position.quantity,
        averageEntryPrice:
          position.averageEntryPrice ||
          amountInvested / (position.quantity || 1),
        amountInvested: amountInvested,
        currentBaseValue: currentBaseValue,
        currentExtra: currentExtra,
        currentValue: currentValue,
        currentPrice: currentPrice,
        return: totalReturn,
        returnPercent:
          amountInvested > 0 ? (totalReturn / amountInvested) * 100 : 0,
        todayReturn: position.performance?.todayReturn || 0,
        todayReturnPercent: position.performance?.todayReturnPercent || 0,
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

    const currentBaseValue = position.performance.currentValue;
    const currentExtra = position.performance.extra || 0;
    const currentValue = currentBaseValue + currentExtra;

    return {
      ...position.toObject(),
      currentAveragePrice: position.averageEntryPrice,
      currentBaseValue: currentBaseValue,
      currentExtra: currentExtra,
      currentValue: currentValue,
      unrealizedPL: currentValue - position.amountInvested,
      unrealizedPLPercent:
        ((currentValue - position.amountInvested) / position.amountInvested) *
        100,
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
      totalExtra: 0,
      positions: [],
    };

    for (const position of positions) {
      const currentBaseValue = position.performance.currentValue;
      const currentExtra = position.performance.extra || 0;
      const currentValue = currentBaseValue + currentExtra;

      summary.totalInvested += position.amountInvested;
      summary.totalCurrentValue += currentValue;
      summary.totalReturn += currentValue - position.amountInvested;
      summary.totalExtra += currentExtra;

      summary.positions.push({
        ...position.toObject(),
        currentBaseValue: currentBaseValue,
        currentExtra: currentExtra,
        currentValue: currentValue,
        currentAveragePrice: position.averageEntryPrice,
        unrealizedPL: currentValue - position.amountInvested,
        unrealizedPLPercent:
          ((currentValue - position.amountInvested) / position.amountInvested) *
          100,
      });
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
      currentExtra: position.performance.extra || 0,
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
        currentBaseValue: position.performance.currentValue,
        currentExtra: position.performance.extra || 0,
        currentValue:
          (position.performance.currentValue || 0) +
          (position.performance.extra || 0),
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

    return {
      asset: position.asset,
      quantity: position.quantity,
      baseValue: position.performance.currentValue,
      extra: position.performance.extra || 0,
      totalValue:
        (position.performance.currentValue || 0) +
        (position.performance.extra || 0),
    };
  }
}

module.exports = new PositionService();
