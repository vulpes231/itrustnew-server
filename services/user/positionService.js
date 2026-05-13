const Position = require("../../models/Position");
const { CustomError } = require("../../utils/utils");
const mongoose = require("mongoose");

class PositionService {
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
      wallet: {
        id: wallet.id,
        name: wallet.name,
      },
      status: "open",
    };

    let position = await Position.findOne(query).session(session);

    if (orderType === "buy") {
      if (position) {
        const newAmountInvested = position.amountInvested + execution.amount;
        const newCurrentValue =
          position.performance.currentValue + execution.positionAmount;

        position.amountInvested = newAmountInvested;
        position.performance.currentValue = newCurrentValue;
        position.performance.totalReturn = newCurrentValue - newAmountInvested;
        position.performance.totalReturnPercent =
          (position.performance.totalReturn / newAmountInvested) * 100;

        await position.save({ session });
      } else {
        // Create new position
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
        };

        position = await Position.create([positionData], { session });
        position = position[0];
      }
    } else if (orderType === "sell") {
      if (!position) {
        throw new CustomError("No open position found for this asset", 400);
      }

      // Calculate closing details
      const sellAmount = execution.amount;
      const sellValue = execution.positionAmount;
      const profitLoss = sellValue - sellAmount;

      // Check if this is a partial or full close
      if (Math.abs(sellAmount - position.amountInvested) < 0.01) {
        // Full close
        position.status = "closed";
        position.performance.totalReturn = profitLoss;
        position.performance.totalReturnPercent =
          (profitLoss / position.amountInvested) * 100;
        position.performance.currentValue = 0;
      } else {
        // Partial close - record in partialCloses
        const percentClosed = (sellAmount / position.amountInvested) * 100;
        const remainingPrincipal = position.amountInvested - sellAmount;
        const remainingProfitLoss =
          position.performance.totalReturn - profitLoss;

        position.partialCloses.push({
          percentClosed: parseFloat(percentClosed.toFixed(2)),
          principalClosed: sellAmount,
          profitLossClosed: profitLoss,
          closedAt: new Date(),
          remainingPrincipal: remainingPrincipal,
          remainingProfitLoss: remainingProfitLoss,
        });

        // Update position with remaining values
        position.amountInvested = remainingPrincipal;
        position.performance.currentValue -= sellValue;
        position.performance.totalReturn = remainingProfitLoss;
        position.performance.totalReturnPercent =
          (remainingProfitLoss / remainingPrincipal) * 100;
      }

      await position.save({ session });
    }

    return position;
  }

  async closePositionFromSell(trade, currentPrice, session = null) {
    const { userId, asset, execution, wallet, performance } = trade;

    const position = await Position.findOne({
      userId,
      "asset.assetId": asset.assetId,
      "wallet.id": wallet.id,
      status: "open",
    }).session(session);

    if (!position) {
      throw new CustomError("No open position found for this asset", 400);
    }

    // Calculate current position value
    const currentPositionValue =
      position.amountInvested *
      (currentPrice /
        (position.performance.currentValue / position.amountInvested));
    const currentTotalReturn = currentPositionValue - position.amountInvested;

    // Check if trade is closing fully or partially
    const isFullClose =
      Math.abs(execution.amount - position.amountInvested) < 0.01;

    if (isFullClose) {
      // Complete position closure
      position.status = "closed";
      position.performance.totalReturn = currentTotalReturn;
      position.performance.totalReturnPercent =
        (currentTotalReturn / position.amountInvested) * 100;
      position.performance.currentValue = 0;
      position.closedAt = new Date();
    } else {
      // Partial close
      const closeRatio = execution.amount / position.amountInvested;
      const principalToClose = position.amountInvested * closeRatio;
      const valueToClose = currentPositionValue * closeRatio;
      const profitToClose = currentTotalReturn * closeRatio;

      const remainingPrincipal = position.amountInvested - principalToClose;
      const remainingValue = currentPositionValue - valueToClose;
      const remainingProfit = currentTotalReturn - profitToClose;

      // Record partial closure
      position.partialCloses.push({
        percentClosed: closeRatio * 100,
        principalClosed: principalToClose,
        profitLossClosed: profitToClose,
        closedAt: new Date(),
        remainingPrincipal: remainingPrincipal,
        remainingProfitLoss: remainingProfit,
        priceAtClose: currentPrice,
      });

      // Update position
      position.amountInvested = remainingPrincipal;
      position.performance.currentValue = remainingValue;
      position.performance.totalReturn = remainingProfit;
      position.performance.totalReturnPercent =
        (remainingProfit / remainingPrincipal) * 100;
    }

    await position.save({ session });
    return position;
  }

  async updatePositionPerformance(position, currentPrice) {
    const currentValue =
      position.orderType === "buy"
        ? position.amountInvested *
          (currentPrice /
            (position.performance.currentValue / position.amountInvested))
        : position.amountInvested;

    const totalReturn = currentValue - position.amountInvested;
    const totalReturnPercent = (totalReturn / position.amountInvested) * 100;

    const todayReturn =
      currentValue - (position.performance.currentValue || currentValue);
    const todayReturnPercent = position.performance.currentValue
      ? (todayReturn / position.performance.currentValue) * 100
      : 0;

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
      positions: [],
    };

    for (const position of positions) {
      summary.totalInvested += position.amountInvested;
      summary.totalCurrentValue += position.performance.currentValue;
      summary.totalReturn += position.performance.totalReturn;

      summary.positions.push({
        asset: position.asset,
        amountInvested: position.amountInvested,
        currentValue: position.performance.currentValue,
        return: position.performance.totalReturn,
        returnPercent: position.performance.totalReturnPercent,
      });
    }

    if (summary.totalInvested > 0) {
      summary.totalReturnPercent =
        (summary.totalReturn / summary.totalInvested) * 100;
    }

    return summary;
  }

  async getWalletPositions(walletId, userId) {
    return await Position.find({
      userId,
      "wallet.id": walletId,
      status: "open",
    }).populate("asset.assetId");
  }

  async getUserPositionByAsset(userId, assetId, walletId) {
    return await Position.findOne({
      userId,
      "asset.assetId": assetId,
      "wallet.id": walletId,
      status: "open",
    });
  }

  async verifyPositionForSell(userId, assetId, walletId, sellAmount) {
    const position = await Position.findOne({
      userId,
      "asset.assetId": assetId,
      "wallet.id": walletId,
      status: "open",
    });

    if (!position) {
      throw new CustomError("No open position found for this asset", 400);
    }

    if (sellAmount > position.amountInvested) {
      throw new CustomError(
        `Cannot sell more than available. Available: ${position.amountInvested}, Requested: ${sellAmount}`,
        400,
      );
    }

    return position;
  }
}

module.exports = new PositionService();
