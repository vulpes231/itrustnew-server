const Position = require("../../models/Position");
const Trade = require("../../models/Trade");
const { CustomError } = require("../../utils/utils");
const mongoose = require("mongoose");

class PositionService {
  async redistributeTradeExtra(position, session = null) {
    if (!position.tradeIds?.length) return;

    let query = Trade.find({
      _id: { $in: position.tradeIds },
    });

    if (session) query = query.session(session);

    const trades = await query;

    if (!trades.length) return;

    const positionExtra = Number(position.performance?.extra || 0);

    const totalAmount = trades.reduce(
      (sum, trade) => sum + Number(trade.execution?.amount || 0),
      0,
    );

    let distributedExtra = 0;

    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];

      const tradeExtra =
        i === trades.length - 1
          ? positionExtra - distributedExtra
          : totalAmount > 0
            ? positionExtra *
              (Number(trade.execution?.amount || 0) / totalAmount)
            : positionExtra / trades.length;

      const roundedExtra = Number(tradeExtra.toFixed(4));
      distributedExtra += roundedExtra;

      if (!trade.performance) trade.performance = {};

      // currentBaseValue already excludes the bonus.
      // Never subtract the old bonus from it again.
      const currentBaseValue = Number(
        trade.performance.currentBaseValue ??
          trade.execution?.positionAmount ??
          trade.execution?.amount ??
          0,
      );

      trade.extra = roundedExtra;

      trade.performance.currentBaseValue = currentBaseValue;
      trade.performance.currentValue = Number(
        (currentBaseValue + roundedExtra).toFixed(4),
      );

      const entryCost = Number(
        trade.execution?.positionCost ??
          trade.execution?.positionAmount ??
          trade.execution?.amount ??
          0,
      );

      // Market P/L + allocated bonus.
      // Borrowed capital is not profit.
      const marketProfit = currentBaseValue - entryCost;

      trade.performance.totalReturn = Number(
        (marketProfit + roundedExtra).toFixed(4),
      );

      const investedAmount = Number(trade.execution?.amount || 0);

      trade.performance.totalReturnPercent =
        investedAmount > 0
          ? Number(
              ((trade.performance.totalReturn / investedAmount) * 100).toFixed(
                4,
              ),
            )
          : 0;

      await trade.save(session ? { session } : {});
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

    let positionQuery = Position.findOne(query);

    if (session) positionQuery = positionQuery.session(session);

    let position = await positionQuery;

    if (orderType === "buy") {
      const tradeQuantity = Number(execution.quantity);
      const tradeAmount = Number(execution.amount);
      const tradePrice = Number(execution.price);

      const tradeMarketValue = Number(execution.positionAmount ?? tradeAmount);

      const tradeMarginDebt = Number(
        execution.marginDebt ?? Math.max(0, tradeMarketValue - tradeAmount),
      );

      const tradeExtra = Number(extra || 0);

      if (
        !Number.isFinite(tradeQuantity) ||
        tradeQuantity <= 0 ||
        !Number.isFinite(tradeAmount) ||
        tradeAmount <= 0 ||
        !Number.isFinite(tradeMarketValue) ||
        tradeMarketValue <= 0
      ) {
        throw new CustomError("Invalid position values!", 400);
      }

      if (position) {
        const existingAmount = Number(position.amountInvested || 0);

        const existingQuantity = Number(position.quantity || 0);

        const existingCost = Number(
          position.positionCost ?? position.performance?.currentBaseValue ?? 0,
        );

        const existingDebt = Number(position.marginDebt || 0);

        const existingBaseValue = Number(
          position.performance?.currentBaseValue || 0,
        );

        const existingExtra = Number(position.performance?.extra || 0);

        const newTotalAmount = existingAmount + tradeAmount;
        const newTotalQuantity = existingQuantity + tradeQuantity;

        const newPositionCost = existingCost + tradeMarketValue;

        const newMarginDebt = existingDebt + tradeMarginDebt;

        const newBaseValue = existingBaseValue + tradeMarketValue;

        const newExtra = existingExtra + tradeExtra;

        position.amountInvested = newTotalAmount;
        position.quantity = newTotalQuantity;
        position.positionCost = newPositionCost;
        position.marginDebt = newMarginDebt;

        position.averageEntryPrice =
          newTotalQuantity > 0 ? newPositionCost / newTotalQuantity : 0;

        if (!position.performance) position.performance = {};

        position.performance.currentBaseValue = newBaseValue;
        position.performance.currentValue = newBaseValue + newExtra;

        position.performance.currentPrice = tradePrice;
        position.performance.extra = newExtra;

        // Market P/L + bonus.
        // Margin debt is deliberately excluded.
        const marketProfitLoss = newBaseValue - newPositionCost;

        position.performance.totalReturn = marketProfitLoss + newExtra;

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
          positionAmount: tradeMarketValue,
          marginDebt: tradeMarginDebt,
          price: tradePrice,
          extra: tradeExtra,
          timestamp: new Date(),
        });

        await position.save({ session });

        await this.redistributeTradeExtra(position, session);
      } else {
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
          orderType: "buy",
          wallet: {
            id: wallet.id,
            name: wallet.name,
          },
          amountInvested: tradeAmount,
          positionCost: tradeMarketValue,
          marginDebt: tradeMarginDebt,
          quantity: tradeQuantity,
          averageEntryPrice: tradePrice,

          performance: {
            currentBaseValue,
            currentPrice: tradePrice,
            currentValue,
            extra: tradeExtra,

            // Market P/L starts at zero.
            totalReturn: tradeExtra,
            totalReturnPercent:
              tradeAmount > 0 ? (tradeExtra / tradeAmount) * 100 : 0,

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
              positionAmount: tradeMarketValue,
              marginDebt: tradeMarginDebt,
              price: tradePrice,
              extra: tradeExtra,
              timestamp: new Date(),
            },
          ],
        };

        const [createdPosition] = await Position.create([positionData], {
          session,
        });

        position = createdPosition;
      }
    } else if (orderType === "sell") {
      if (!position) {
        throw new CustomError("No open position found for this asset", 400);
      }

      if (!position.performance) position.performance = {};

      const oldQuantity = Number(position.quantity || 0);
      const oldPrincipal = Number(position.amountInvested || 0);
      const oldCost = Number(position.positionCost ?? 0);
      const oldDebt = Number(position.marginDebt || 0);
      const oldBaseValue = Number(position.performance.currentBaseValue || 0);
      const oldExtra = Number(position.performance.extra || 0);

      const sellQuantity = Number(execution.quantity);
      const suppliedRatio = Number(execution.closeRatio);
      const sellMarketValue = Number(execution.marketValue);

      if (
        !Number.isFinite(oldQuantity) ||
        oldQuantity <= 0 ||
        !Number.isFinite(sellQuantity) ||
        sellQuantity <= 0 ||
        sellQuantity > oldQuantity + 0.000001
      ) {
        throw new CustomError("Invalid sell quantity!", 400);
      }

      // Prefer the ratio calculated by closePosition().
      const closeRatio = Number.isFinite(suppliedRatio)
        ? suppliedRatio
        : sellQuantity / oldQuantity;

      if (closeRatio <= 0 || closeRatio > 1) {
        throw new CustomError("Invalid close ratio!", 400);
      }

      if (
        !Number.isFinite(sellMarketValue) ||
        sellMarketValue < 0 ||
        sellMarketValue > oldBaseValue + 0.000001
      ) {
        throw new CustomError("Invalid market value to close!", 400);
      }

      // Allocate all position values using the same close ratio.
      const quantityClosed = oldQuantity * closeRatio;
      const principalClosed = oldPrincipal * closeRatio;
      const costClosed = oldCost * closeRatio;
      const debtClosed = oldDebt * closeRatio;
      const extraClosed = oldExtra * closeRatio;

      const realizedMarketProfit = sellMarketValue - costClosed;
      const realizedProfit = realizedMarketProfit + extraClosed;

      const remainingQuantity = Math.max(0, oldQuantity - quantityClosed);
      const remainingPrincipal = Math.max(0, oldPrincipal - principalClosed);
      const remainingCost = Math.max(0, oldCost - costClosed);
      const remainingDebt = Math.max(0, oldDebt - debtClosed);
      const remainingBaseValue = Math.max(0, oldBaseValue - sellMarketValue);
      const remainingExtra = Math.max(0, oldExtra - extraClosed);

      const isFullClose = closeRatio >= 1 - 0.000001;

      if (isFullClose) {
        position.status = "closed";
        position.closedAt = new Date();

        position.quantity = 0;
        position.amountInvested = 0;
        position.positionCost = 0;
        position.marginDebt = 0;

        position.performance.currentBaseValue = 0;
        position.performance.currentValue = 0;
        position.performance.extra = 0;

        // Preserve realized P/L for historical reporting.
        position.performance.totalReturn = realizedProfit;
        position.performance.totalReturnPercent =
          oldPrincipal > 0 ? (realizedProfit / oldPrincipal) * 100 : 0;
      } else {
        position.quantity = remainingQuantity;
        position.amountInvested = remainingPrincipal;
        position.positionCost = remainingCost;
        position.marginDebt = remainingDebt;

        position.averageEntryPrice =
          remainingQuantity > 0 ? remainingCost / remainingQuantity : 0;

        position.performance.currentBaseValue = remainingBaseValue;
        position.performance.extra = remainingExtra;
        position.performance.currentValue = remainingBaseValue + remainingExtra;

        position.performance.totalReturn =
          remainingBaseValue - remainingCost + remainingExtra;

        position.performance.totalReturnPercent =
          remainingPrincipal > 0
            ? (position.performance.totalReturn / remainingPrincipal) * 100
            : 0;
      }

      if (!position.partialCloses) position.partialCloses = [];

      position.partialCloses.push({
        percentClosed: Number((closeRatio * 100).toFixed(2)),
        quantityClosed,
        principalClosed,
        positionCostClosed: costClosed,
        marginDebtClosed: debtClosed,
        marketValueClosed: sellMarketValue,
        extraClosed,
        proceeds: sellMarketValue + extraClosed,
        marketProfitClosed: realizedMarketProfit,
        profitLossClosed: realizedProfit,
        closedAt: new Date(),
        remainingQuantity,
        remainingPrincipal,
        remainingPositionCost: remainingCost,
        remainingMarginDebt: remainingDebt,
        remainingExtra,
        remainingProfitLoss: isFullClose
          ? 0
          : remainingBaseValue - remainingCost + remainingExtra,
        priceAtClose: execution.price,
      });

      if (!position.history) position.history = [];

      position.history.push({
        action: isFullClose ? "close" : "remove",
        tradeId: trade._id,
        quantity: quantityClosed,
        amount: principalClosed,
        positionAmount: sellMarketValue,
        marginDebt: debtClosed,
        price: execution.price,
        extra: extraClosed,
        profitLoss: realizedProfit,
        timestamp: new Date(),
      });

      await position.save(session ? { session } : {});
    }

    return position;
  }

  async updatePositionPerformance(position, currentPrice) {
    const price = Number(currentPrice);

    if (!Number.isFinite(price) || price <= 0) {
      throw new CustomError("Invalid current price!", 400);
    }

    const quantity = Number(position.quantity || 0);
    const principal = Number(position.amountInvested || 0);
    const positionCost = Number(
      position.positionCost ?? position.performance?.currentBaseValue ?? 0,
    );

    const currentExtra = Number(position.performance?.extra || 0);

    // Full leveraged position market value.
    const currentBaseValue = quantity * price;

    // Market value plus bonus.
    const currentValue = currentBaseValue + currentExtra;

    // P/L uses leveraged entry cost, not user-funded capital.
    const marketProfit = currentBaseValue - positionCost;
    const totalReturn = marketProfit + currentExtra;

    const totalReturnPercent =
      principal > 0 ? (totalReturn / principal) * 100 : 0;

    const previousValue = Number(
      position.performance?.currentValue ?? currentValue,
    );

    const previousBaseValue = Number(
      position.performance?.currentBaseValue ?? currentBaseValue,
    );

    const todayReturn = currentValue - previousValue;

    const todayReturnPercent =
      previousValue > 0 ? (todayReturn / previousValue) * 100 : 0;

    if (!position.performance) position.performance = {};

    position.performance.currentBaseValue = currentBaseValue;
    position.performance.currentValue = currentValue;
    position.performance.currentPrice = price;
    position.performance.extra = currentExtra;

    position.performance.totalReturn = totalReturn;
    position.performance.totalReturnPercent = totalReturnPercent;

    position.performance.todayReturn = todayReturn;
    position.performance.todayReturnPercent = todayReturnPercent;

    // Preserve separate market-only movement for daily reporting.
    position.performance.todayMarketReturn =
      currentBaseValue - previousBaseValue;

    await position.save();

    return position;
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
      const positionCost = Number(
        position.positionCost ?? position.performance?.currentBaseValue ?? 0,
      );

      const totalReturn = currentBaseValue - positionCost + currentExtra;

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
