// tradeHelpers.js
const mongoose = require("mongoose");
const Position = require("../../models/Position");
// Position

class TradeHelpers {
  /**
   * Update or create position when buying
   */
  static async updatePositionOnBuy(trade, session = null) {
    const { userId, asset, execution, wallet, planId, fullname, assetType } =
      trade;

    let position = await Position.findOne({
      userId,
      "asset.assetId": asset.assetId,
      "wallet.id": wallet.id,
      status: "open",
    }).session(session);

    if (position) {
      // Calculate new values with quantity
      const existingAmount = position.amountInvested;
      const existingQuantity = position.quantity;
      const existingExtra = position.performance.extra || 0;

      const newAmount = existingAmount + execution.amount;
      const newQuantity = existingQuantity + execution.quantity;
      const newAveragePrice = newAmount / newQuantity;
      const newCurrentValue =
        position.performance.currentValue + execution.positionAmount;
      const newExtra = existingExtra + (trade.extra || 0);

      position.amountInvested = newAmount;
      position.quantity = newQuantity;
      position.averageEntryPrice = newAveragePrice;
      position.performance.currentValue = newCurrentValue;
      position.performance.extra = newExtra;
      position.performance.totalReturn = newCurrentValue + newExtra - newAmount;
      position.performance.totalReturnPercent =
        (position.performance.totalReturn / newAmount) * 100;

      if (!position.tradeIds) position.tradeIds = [];
      position.tradeIds.push(trade._id);

      if (!position.history) position.history = [];
      position.history.push({
        action: "add",
        tradeId: trade._id,
        quantity: execution.quantity,
        amount: execution.amount,
        price: execution.price,
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
        orderType: "buy",
        wallet: {
          id: wallet.id,
          name: wallet.name,
        },
        amountInvested: execution.amount,
        quantity: execution.quantity, // ✅ Add quantity
        averageEntryPrice: execution.price, // ✅ Add average entry price
        performance: {
          currentValue: execution.positionAmount,
          totalReturn: trade.extra || 0, // Include extra if present
          totalReturnPercent:
            execution.amount > 0
              ? ((trade.extra || 0) / execution.amount) * 100
              : 0,
          todayReturn: 0,
          todayReturnPercent: 0,
          extra: trade.extra || 0,
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

    return position;
  }

  /**
   * Update position when selling/closing trade
   */
  static async updatePositionOnSell(
    trade,
    percentToClose,
    currentPrice,
    session = null,
  ) {
    const { userId, asset, execution, wallet } = trade;

    const position = await Position.findOne({
      userId,
      "asset.assetId": asset.assetId,
      "wallet.id": wallet.id,
      status: "open",
    }).session(session);

    if (!position) {
      console.warn(`No position found for trade ${trade._id}`);
      return null;
    }

    const closeRatio = percentToClose / 100;

    // Calculate using quantity instead of amount
    const quantityToClose = execution.quantity * closeRatio;
    const tradeRatioToPosition = execution.quantity / position.quantity;
    const positionQuantityToClose =
      position.quantity * closeRatio * tradeRatioToPosition;
    const positionPrincipalToClose =
      position.amountInvested * closeRatio * tradeRatioToPosition;
    const positionValueToClose =
      position.performance.currentValue * closeRatio * tradeRatioToPosition;
    const positionExtraToClose =
      (position.performance.extra || 0) * closeRatio * tradeRatioToClose;
    const positionProfitToClose =
      position.performance.totalReturn * closeRatio * tradeRatioToPosition;

    const remainingPositionQuantity =
      position.quantity - positionQuantityToClose;
    const remainingPositionPrincipal =
      position.amountInvested - positionPrincipalToClose;
    const remainingPositionValue =
      position.performance.currentValue - positionValueToClose;
    const remainingPositionExtra =
      (position.performance.extra || 0) - positionExtraToClose;
    const remainingPositionProfit =
      remainingPositionValue +
      remainingPositionExtra -
      remainingPositionPrincipal;

    if (
      percentToClose === 100 &&
      Math.abs(remainingPositionQuantity) < 0.000001
    ) {
      // Full close of position
      position.status = "closed";
      position.performance.currentValue = 0;
      position.performance.extra = 0;
      position.performance.totalReturn = position.performance.totalReturn;
      position.closedAt = new Date();
      position.closeReason = "trade_closed";
    } else {
      // Partial close
      if (!position.partialCloses) position.partialCloses = [];

      position.partialCloses.push({
        tradeId: trade._id,
        percentClosed: percentToClose * tradeRatioToPosition,
        quantityClosed: positionQuantityToClose,
        principalClosed: positionPrincipalToClose,
        profitLossClosed: positionProfitToClose,
        extraClosed: positionExtraToClose,
        valueClosed: positionValueToClose,
        closedAt: new Date(),
        exitPrice: currentPrice,
        remainingQuantity: remainingPositionQuantity,
        remainingPrincipal: remainingPositionPrincipal,
        remainingProfitLoss: remainingPositionProfit,
        remainingExtra: remainingPositionExtra,
        remainingValue: remainingPositionValue,
      });

      position.quantity = remainingPositionQuantity;
      position.amountInvested = remainingPositionPrincipal;
      position.performance.currentValue = remainingPositionValue;
      position.performance.extra = remainingPositionExtra;
      position.performance.totalReturn = remainingPositionProfit;
      position.performance.totalReturnPercent =
        (remainingPositionProfit / remainingPositionPrincipal) * 100;
    }

    // Track trade closure
    if (!position.tradeClosures) position.tradeClosures = [];
    position.tradeClosures.push({
      tradeId: trade._id,
      percentClosed: percentToClose,
      quantityClosed: positionQuantityToClose,
      principalClosed: positionPrincipalToClose,
      profitLossClosed: positionProfitToClose,
      closedAt: new Date(),
      price: currentPrice,
    });

    await position.save({ session });
    return position;
  }

  /**
   * Calculate trade close values
   */
  static calculateCloseValues(trade, currentPrice, percentToClose) {
    const originalQuantity = trade.execution.quantity;
    const originalAmount = trade.execution.amount;
    const originalLeverage = trade.execution.leverage || 1;
    const extraBonus = trade.extra || 0;

    let currentValue, totalReturn;

    if (trade.orderType === "buy") {
      currentValue = originalQuantity * currentPrice * originalLeverage;
      totalReturn = currentValue - originalAmount;
    } else if (trade.orderType === "sell") {
      currentValue =
        originalAmount - originalQuantity * currentPrice * originalLeverage;
      totalReturn = currentValue - originalAmount;
    } else {
      currentValue = originalQuantity * currentPrice;
      totalReturn = currentValue - originalAmount;
    }

    const totalCurrentValue = currentValue + extraBonus;
    const totalProfitLoss = totalReturn + extraBonus;
    const closeRatio = percentToClose / 100;

    return {
      closeRatio,
      currentPrice,
      originalAmount,
      originalQuantity,
      currentValue,
      totalReturn,
      totalCurrentValue,
      totalProfitLoss,
      totalProfitLossPercentage: (totalProfitLoss / originalAmount) * 100,
      principalToClose: originalAmount * closeRatio,
      profitLossToClose: totalProfitLoss * closeRatio,
      currentValueToClose: totalCurrentValue * closeRatio,
      remainingPrincipal: originalAmount * (1 - closeRatio),
      remainingProfitLoss: totalProfitLoss * (1 - closeRatio),
      remainingCurrentValue: totalCurrentValue * (1 - closeRatio),
      remainingQuantity: originalQuantity * (1 - closeRatio),
      remainingBonus: extraBonus * (1 - closeRatio),
    };
  }

  /**
   * Update wallet on trade close
   */
  static async updateWalletOnClose(wallet, calculations, session = null) {
    const { principalToClose, profitLossToClose } = calculations;

    wallet.availableBalance += principalToClose;

    if (profitLossToClose > 0) {
      wallet.totalBalance += profitLossToClose;
      wallet.availableBalance += profitLossToClose;
    } else if (profitLossToClose < 0) {
      const loss = Math.abs(profitLossToClose);
      wallet.totalBalance -= loss;
      wallet.availableBalance -= loss;
      if (wallet.availableBalance < 0) wallet.availableBalance = 0;
    }

    if (wallet.totalBalance < 0) wallet.totalBalance = 0;
    if (wallet.availableBalance < 0) wallet.availableBalance = 0;

    await wallet.save({ session });
    return wallet;
  }

  /**
   * Update trade on close
   */
  static async updateTradeOnClose(
    trade,
    calculations,
    percentToClose,
    session = null,
  ) {
    const {
      remainingPrincipal,
      remainingQuantity,
      remainingCurrentValue,
      remainingProfitLoss,
      remainingBonus,
      totalCurrentValue,
      totalProfitLoss,
      totalProfitLossPercentage,
      principalToClose,
      profitLossToClose,
      currentValueToClose,
      currentPrice,
    } = calculations;

    if (percentToClose === 100) {
      trade.performance.currentValue = totalCurrentValue;
      trade.performance.totalReturn = totalProfitLoss;
      trade.performance.totalReturnPercent = totalProfitLossPercentage;
      trade.targets.exitPoint = currentPrice;
      trade.status = "closed";
      trade.closedAt = new Date();
      trade.closeReason = "manual_close";
    } else {
      trade.execution.amount = remainingPrincipal;
      trade.execution.quantity = remainingQuantity;
      trade.performance.currentValue = remainingCurrentValue;
      trade.performance.totalReturn = remainingProfitLoss;
      trade.performance.totalReturnPercent =
        (remainingProfitLoss / remainingPrincipal) * 100;
      trade.extra = remainingBonus;

      if (!trade.partialCloses) trade.partialCloses = [];

      trade.partialCloses.push({
        percentClosed: percentToClose,
        principalClosed: principalToClose,
        profitLossClosed: profitLossToClose,
        currentValueClosed: currentValueToClose,
        closedAt: new Date(),
        exitPrice: currentPrice,
        remainingPrincipal: remainingPrincipal,
        remainingProfitLoss: remainingProfitLoss,
        remainingQuantity: remainingQuantity,
      });
    }

    await trade.save({ session });
    return trade;
  }
}

module.exports = TradeHelpers;
