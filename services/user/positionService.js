const Position = require("../../models/Position");
const Trade = require("../../models/Trade");
const { CustomError } = require("../../utils/utils");
const mongoose = require("mongoose");

const Asset = require("../../models/Asset");
const Wallet = require("../../models/Wallet");

const {
  calculateMarketValue,
  calculateRealizedProfit,
  calculateReturnPercent,
} = require("../../utils/trading/positionCalculation");

const {
  requireFiniteNumber,
  validateMarketPrice,
} = require("../../utils/trading/tradeValidation");

class PositionService {
  async redistributeTradeExtra(position, session = null) {
    if (!position.tradeIds?.length) return;

    let query = Trade.find({
      _id: { $in: position.tradeIds },
    });

    if (session) query = query.session(session);

    const trades = await query;

    if (!trades.length) return;

    const positionExtra = Number(position.performance?.extra ?? 0);

    if (!Number.isFinite(positionExtra) || positionExtra < 0) {
      throw new Error("Position bonus must be a valid non-negative number");
    }

    const tradeAmounts = trades.map((trade) => {
      const amount = Number(trade.execution?.amount);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`Invalid execution amount for trade ${trade._id}`);
      }

      return amount;
    });

    const totalAmount = tradeAmounts.reduce((sum, amount) => sum + amount, 0);

    let distributedExtra = 0;

    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];

      // Allocate proportionally to the original user-funded trade amount.
      // The last trade receives the rounding remainder.
      const tradeExtra =
        i === trades.length - 1
          ? Number((positionExtra - distributedExtra).toFixed(4))
          : Number(
              (totalAmount > 0
                ? positionExtra * (tradeAmounts[i] / totalAmount)
                : positionExtra / trades.length
              ).toFixed(4),
            );

      if (!trade.performance) trade.performance = {};

      const currentBaseValue = Number(trade.performance.currentBaseValue);

      const entryCost = Number(trade.execution?.positionCost);

      if (
        !Number.isFinite(currentBaseValue) ||
        currentBaseValue < 0 ||
        !Number.isFinite(entryCost) ||
        entryCost < 0
      ) {
        throw new Error(
          `Missing or invalid market value or entry cost for trade ${trade._id}`,
        );
      }

      trade.extra = tradeExtra;

      trade.performance.currentValue = Number(
        (currentBaseValue + tradeExtra).toFixed(4),
      );

      // Unrealized market P/L + allocated bonus.
      // Margin debt is not deducted from profit.
      const totalReturn = currentBaseValue - entryCost + tradeExtra;

      trade.performance.totalReturn = Number(totalReturn.toFixed(4));

      const investedAmount = tradeAmounts[i];

      trade.performance.totalReturnPercent =
        investedAmount > 0
          ? Number(((totalReturn / investedAmount) * 100).toFixed(4))
          : 0;

      await trade.save(session ? { session } : {});
      distributedExtra += tradeExtra;
    }
  }

  async liquidatePosition({ userId, positionId }) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      if (
        !mongoose.Types.ObjectId.isValid(userId) ||
        !mongoose.Types.ObjectId.isValid(positionId)
      ) {
        throw new CustomError("Invalid user or position ID.", 400);
      }

      const position = await Position.findOne({
        _id: positionId,
        userId,
      }).session(session);

      if (!position) {
        throw new CustomError("Position not found.", 404);
      }

      if (position.status !== "open") {
        throw new CustomError("Position is not open.", 400);
      }

      const asset = await Asset.findById(position.asset.assetId).session(
        session,
      );

      if (!asset) {
        throw new CustomError("Asset not found.", 404);
      }

      let currentPrice;

      try {
        currentPrice = validateMarketPrice(asset.priceData?.current);
      } catch {
        throw new CustomError(
          "Invalid market price. Position cannot be liquidated.",
          400,
        );
      }

      const openTrades = await Trade.find({
        _id: { $in: position.tradeIds },
        userId,
        orderType: "buy",
        status: "open",
      }).session(session);

      if (!openTrades.length) {
        throw new CustomError("No open trades remain in this position.", 400);
      }

      const quantity = requireFiniteNumber(
        position.quantity,
        "Position quantity",
      );

      const positionCost = requireFiniteNumber(
        position.positionCost ?? position.amountInvested,
        "Position cost",
      );

      const principal = requireFiniteNumber(
        position.amountInvested,
        "Amount invested",
      );

      const marginDebt = requireFiniteNumber(
        position.marginDebt ?? 0,
        "Margin debt",
      );

      const extra = requireFiniteNumber(
        position.performance?.extra ?? 0,
        "Position extra",
      );

      if (
        quantity <= 0 ||
        positionCost < 0 ||
        principal < 0 ||
        marginDebt < 0 ||
        extra < 0
      ) {
        throw new CustomError("Invalid position accounting values.", 400);
      }

      const currentBaseValue = calculateMarketValue(quantity, currentPrice);

      const proceeds = currentBaseValue + extra;

      const realizedProfit = calculateRealizedProfit({
        marketValue: currentBaseValue,
        positionCost,
        extra,
      });

      const totalReturnPercent = calculateReturnPercent({
        profit: realizedProfit,
        principal,
      });

      if (!Number.isFinite(proceeds) || proceeds < 0) {
        throw new CustomError("Invalid liquidation value.", 400);
      }

      const wallet = await Wallet.findById(position.wallet.id).session(session);

      if (!wallet || String(wallet.userId) !== String(userId)) {
        throw new CustomError("Position wallet not found for this user.", 404);
      }

      const availableBalance = requireFiniteNumber(
        wallet.balance.available,
        "Wallet available balance",
      );

      const totalBalance = requireFiniteNumber(
        wallet.balance.total,
        "Wallet total balance",
      );

      for (const trade of openTrades) {
        const tradeQuantity = requireFiniteNumber(
          trade.execution?.quantity,
          "Trade quantity",
        );

        const tradePrincipal = requireFiniteNumber(
          trade.execution?.amount,
          "Trade principal",
        );

        const tradePositionCost = requireFiniteNumber(
          trade.execution?.positionCost ??
            trade.execution?.positionAmount ??
            tradePrincipal,
          "Trade position cost",
        );

        const tradeExtra = requireFiniteNumber(trade.extra ?? 0, "Trade extra");

        const tradeBaseValue = calculateMarketValue(
          tradeQuantity,
          currentPrice,
        );

        const tradeProfit = calculateRealizedProfit({
          marketValue: tradeBaseValue,
          positionCost: tradePositionCost,
          extra: tradeExtra,
        });

        trade.status = "closed";
        trade.closedAt = new Date();

        trade.performance = {
          ...(trade.performance?.toObject?.() ?? trade.performance ?? {}),
          currentPrice,
          currentBaseValue: tradeBaseValue,
          currentValue: tradeBaseValue + tradeExtra,
          totalReturn: tradeProfit,
          totalReturnPercent: calculateReturnPercent({
            profit: tradeProfit,
            principal: tradePrincipal,
          }),
        };

        trade.markModified("performance");

        await trade.save({ session });
      }

      wallet.balance.available = availableBalance + proceeds;
      wallet.balance.total = totalBalance + realizedProfit;

      await wallet.save({ session });

      position.status = "closed";
      position.closedAt = new Date();

      position.quantity = 0;
      position.amountInvested = 0;
      position.positionCost = 0;
      position.marginDebt = 0;

      position.performance = {
        ...(position.performance?.toObject?.() ?? position.performance ?? {}),
        currentPrice,
        currentBaseValue,
        currentValue: proceeds,
        extra,
        totalReturn: realizedProfit,
        totalReturnPercent,
      };

      position.markModified("performance");

      await position.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        message: "Position fully liquidated successfully.",
        data: {
          positionId: position._id,
          asset: position.asset,
          walletId: position.wallet.id,
          status: position.status,
          closedTradeCount: openTrades.length,
          closingPrice: currentPrice,
          quantityClosed: quantity,
          proceeds,
          realizedProfit,
          totalReturnPercent,
        },
      };
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      console.error("liquidatePosition error:", error);

      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(
        error.message || "Failed to liquidate position.",
        500,
      );
    } finally {
      await session.endSession();
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

    const toNumber = (value, fallback = NaN) => {
      if (value === null || value === undefined || value === "") {
        return fallback;
      }

      const number = Number(value);

      return Number.isFinite(number) ? number : fallback;
    };

    // Recover entry cost for legacy positions that lack positionCost
    // and averageEntryPrice.
    const getEntryCost = async (pos, fallbackPrice) => {
      const quantity = toNumber(pos.quantity, 0);
      const storedCost = toNumber(pos.positionCost, 0);
      const averagePrice = toNumber(pos.averageEntryPrice, 0);

      if (storedCost > 0) return storedCost;

      if (averagePrice > 0 && quantity > 0) {
        return quantity * averagePrice;
      }

      const tradeIds = pos.tradeIds || [];

      if (tradeIds.length) {
        let tradesQuery = Trade.find({
          _id: { $in: tradeIds },
          orderType: "buy",
        });

        if (session) tradesQuery = tradesQuery.session(session);

        const originalTrades = await tradesQuery;

        let costTotal = 0;
        let quantityTotal = 0;

        for (const originalTrade of originalTrades) {
          const tradeQty = toNumber(originalTrade.execution?.quantity, 0);

          const savedCost = toNumber(originalTrade.execution?.positionCost, 0);

          const savedExposure = toNumber(
            originalTrade.execution?.positionAmount,
            0,
          );

          const entryPrice = toNumber(originalTrade.execution?.price, 0);

          const principal = toNumber(originalTrade.execution?.amount, 0);

          if (tradeQty <= 0) continue;

          const tradeCost =
            savedCost > 0
              ? savedCost
              : savedExposure > 0
                ? savedExposure
                : entryPrice > 0
                  ? tradeQty * entryPrice
                  : principal;

          if (!Number.isFinite(tradeCost) || tradeCost <= 0) {
            continue;
          }

          costTotal += tradeCost;
          quantityTotal += tradeQty;
        }

        if (costTotal > 0 && quantityTotal > 0 && quantity > 0) {
          // Scale original weighted cost to the quantity currently held.
          return (costTotal / quantityTotal) * quantity;
        }
      }

      // Last resort for legacy data with no recoverable entry basis.
      // This assumes zero market P/L for the existing quantity.
      if (quantity > 0 && fallbackPrice > 0) {
        return quantity * fallbackPrice;
      }

      return 0;
    };

    if (orderType === "buy") {
      const tradeQuantity = toNumber(execution.quantity);
      const tradeAmount = toNumber(execution.amount);
      const tradePrice = toNumber(execution.price);
      const tradeExtra = toNumber(extra, 0);

      const storedPositionCost = toNumber(execution.positionCost, 0);

      const storedPositionAmount = toNumber(execution.positionAmount, 0);

      const tradeEntryCost =
        storedPositionCost > 0
          ? storedPositionCost
          : storedPositionAmount > 0
            ? storedPositionAmount
            : tradeQuantity * tradePrice;

      const tradeMarginDebt = toNumber(
        execution.marginDebt,
        Math.max(0, tradeEntryCost - tradeAmount),
      );

      if (
        !Number.isFinite(tradeQuantity) ||
        tradeQuantity <= 0 ||
        !Number.isFinite(tradeAmount) ||
        tradeAmount <= 0 ||
        !Number.isFinite(tradePrice) ||
        tradePrice <= 0 ||
        !Number.isFinite(tradeEntryCost) ||
        tradeEntryCost <= 0 ||
        !Number.isFinite(tradeMarginDebt) ||
        tradeMarginDebt < 0 ||
        !Number.isFinite(tradeExtra) ||
        tradeExtra < 0
      ) {
        throw new CustomError("Invalid position values!", 400);
      }

      if (position) {
        const existingAmount = toNumber(position.amountInvested, 0);

        const existingQuantity = toNumber(position.quantity, 0);

        const existingDebt = toNumber(position.marginDebt, 0);

        const existingExtra = toNumber(position.performance?.extra, 0);

        if (
          existingAmount < 0 ||
          existingQuantity < 0 ||
          existingDebt < 0 ||
          existingExtra < 0
        ) {
          throw new CustomError(
            "Existing position has invalid accounting values!",
            400,
          );
        }

        const existingCost = await getEntryCost(position, tradePrice);

        const newTotalAmount = existingAmount + tradeAmount;
        const newTotalQuantity = existingQuantity + tradeQuantity;
        const newPositionCost = existingCost + tradeEntryCost;
        const newMarginDebt = existingDebt + tradeMarginDebt;
        const newExtra = existingExtra + tradeExtra;

        // Revalue the entire position at the latest buy execution price.
        const newBaseValue = newTotalQuantity * tradePrice;
        const newCurrentValue = newBaseValue + newExtra;

        position.amountInvested = newTotalAmount;
        position.quantity = newTotalQuantity;
        position.positionCost = newPositionCost;
        position.marginDebt = newMarginDebt;

        position.averageEntryPrice =
          newTotalQuantity > 0 ? newPositionCost / newTotalQuantity : 0;

        if (!position.performance) {
          position.performance = {};
        }

        position.performance.currentBaseValue = newBaseValue;
        position.performance.currentValue = newCurrentValue;
        position.performance.currentPrice = tradePrice;
        position.performance.extra = newExtra;

        // P/L is based on entry cost, not principal or debt.
        position.performance.totalReturn =
          newBaseValue - newPositionCost + newExtra;

        position.performance.totalReturnPercent =
          newTotalAmount > 0
            ? (position.performance.totalReturn / newTotalAmount) * 100
            : 0;

        if (!position.tradeIds) position.tradeIds = [];

        if (
          trade._id &&
          !position.tradeIds.some(
            (id) => id.toString() === trade._id.toString(),
          )
        ) {
          position.tradeIds.push(trade._id);
        }

        if (!position.history) position.history = [];

        position.history.push({
          action: "add",
          tradeId: trade._id,
          quantity: tradeQuantity,
          amount: tradeAmount,
          positionAmount: tradeEntryCost,
          marginDebt: tradeMarginDebt,
          price: tradePrice,
          extra: tradeExtra,
          timestamp: new Date(),
        });

        await position.save(session ? { session } : {});

        await this.redistributeTradeExtra(position, session);
      } else {
        const currentBaseValue = tradeQuantity * tradePrice;
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
          positionCost: tradeEntryCost,
          marginDebt: tradeMarginDebt,
          quantity: tradeQuantity,

          averageEntryPrice:
            tradeQuantity > 0 ? tradeEntryCost / tradeQuantity : tradePrice,

          performance: {
            currentBaseValue,
            currentPrice: tradePrice,
            currentValue,
            extra: tradeExtra,

            totalReturn: currentBaseValue - tradeEntryCost + tradeExtra,

            totalReturnPercent:
              tradeAmount > 0
                ? ((currentBaseValue - tradeEntryCost + tradeExtra) /
                    tradeAmount) *
                  100
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
          tradeIds: trade._id ? [trade._id] : [],

          history: [
            {
              action: "create",
              tradeId: trade._id,
              quantity: tradeQuantity,
              amount: tradeAmount,
              positionAmount: tradeEntryCost,
              marginDebt: tradeMarginDebt,
              price: tradePrice,
              extra: tradeExtra,
              timestamp: new Date(),
            },
          ],
        };

        const [createdPosition] = await Position.create(
          [positionData],
          session ? { session } : {},
        );

        position = createdPosition;
      }
    } else if (orderType === "sell") {
      if (!position) {
        throw new CustomError("No open position found for this asset", 400);
      }

      if (!position.performance) position.performance = {};

      const oldQuantity = toNumber(position.quantity, 0);
      const oldPrincipal = toNumber(position.amountInvested, 0);
      const oldDebt = toNumber(position.marginDebt, 0);
      const oldExtra = toNumber(position.performance.extra, 0);

      const sellQuantity = toNumber(execution.quantity);
      const sellPrice = toNumber(execution.price);

      if (
        oldQuantity <= 0 ||
        oldPrincipal < 0 ||
        oldDebt < 0 ||
        oldExtra < 0 ||
        !Number.isFinite(sellQuantity) ||
        sellQuantity <= 0 ||
        sellQuantity > oldQuantity + 0.000001 ||
        !Number.isFinite(sellPrice) ||
        sellPrice <= 0
      ) {
        throw new CustomError("Invalid sell values!", 400);
      }

      const oldCost = await getEntryCost(position, sellPrice);

      if (!Number.isFinite(oldCost) || oldCost <= 0) {
        throw new CustomError("Unable to determine position entry cost!", 400);
      }

      const oldBaseValue = oldQuantity * sellPrice;

      const suppliedMarketValue = toNumber(execution.positionAmount, NaN);

      const sellMarketValue = Number.isFinite(suppliedMarketValue)
        ? suppliedMarketValue
        : sellQuantity * sellPrice;

      if (sellMarketValue < 0 || sellMarketValue > oldBaseValue + 0.000001) {
        throw new CustomError("Invalid market value to close!", 400);
      }

      const suppliedRatio = toNumber(execution.closeRatio, NaN);

      const closeRatio = Number.isFinite(suppliedRatio)
        ? suppliedRatio
        : sellQuantity / oldQuantity;

      if (
        closeRatio <= 0 ||
        closeRatio > 1 ||
        Math.abs(sellQuantity - oldQuantity * closeRatio) >
          Math.max(0.000001, oldQuantity * 0.000001)
      ) {
        throw new CustomError("Invalid close ratio!", 400);
      }

      const isFullClose = closeRatio >= 1 - 0.000001;
      const ratio = isFullClose ? 1 : closeRatio;
      const remainingRatio = 1 - ratio;

      const quantityClosed = oldQuantity * ratio;
      const principalClosed = oldPrincipal * ratio;
      const costClosed = oldCost * ratio;
      const debtClosed = oldDebt * ratio;
      const extraClosed = oldExtra * ratio;

      const realizedMarketProfit = sellMarketValue - costClosed;
      const realizedProfit = realizedMarketProfit + extraClosed;

      const remainingQuantity = isFullClose ? 0 : oldQuantity * remainingRatio;

      const remainingPrincipal = isFullClose
        ? 0
        : oldPrincipal * remainingRatio;

      const remainingCost = isFullClose ? 0 : oldCost - costClosed;

      const remainingDebt = isFullClose ? 0 : oldDebt - debtClosed;

      const remainingBaseValue = isFullClose
        ? 0
        : remainingQuantity * sellPrice;

      const remainingExtra = isFullClose ? 0 : oldExtra - extraClosed;

      if (isFullClose) {
        position.status = "closed";
        position.closedAt = new Date();

        position.quantity = 0;
        position.amountInvested = 0;
        position.positionCost = 0;
        position.marginDebt = 0;
        position.averageEntryPrice = 0;

        position.performance.currentBaseValue = 0;
        position.performance.currentValue = 0;
        position.performance.extra = 0;

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
        position.performance.currentValue = remainingBaseValue + remainingExtra;
        position.performance.extra = remainingExtra;

        position.performance.totalReturn =
          remainingBaseValue - remainingCost + remainingExtra;

        position.performance.totalReturnPercent =
          remainingPrincipal > 0
            ? (position.performance.totalReturn / remainingPrincipal) * 100
            : 0;

        position.performance.currentPrice = sellPrice;
      }

      if (!position.partialCloses) position.partialCloses = [];

      position.partialCloses.push({
        percentClosed: Number((ratio * 100).toFixed(4)),
        quantityClosed,
        principalClosed,
        positionCostClosed: costClosed,
        marginDebtClosed: debtClosed,
        marketValueClosed: sellMarketValue,
        extraClosed,

        proceeds: sellMarketValue + extraClosed,
        marginDebtRepaid: debtClosed,
        netWalletCredit: sellMarketValue + extraClosed - debtClosed,

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

        priceAtClose: sellPrice,
      });

      if (!position.history) position.history = [];

      position.history.push({
        action: isFullClose ? "close" : "remove",
        tradeId: trade._id,
        quantity: quantityClosed,
        amount: principalClosed,
        positionAmount: sellMarketValue,
        marginDebt: debtClosed,
        price: sellPrice,
        extra: extraClosed,
        profitLoss: realizedProfit,
        timestamp: new Date(),
      });

      await position.save(session ? { session } : {});
    }

    return position;
  }

  async updatePositionPerformance(position, currentPrice, session = null) {
    const price = Number(currentPrice);

    if (!Number.isFinite(price) || price <= 0) {
      throw new CustomError("Invalid current price!", 400);
    }

    const quantity = Number(position.quantity ?? 0);
    const principal = Number(position.amountInvested ?? 0);
    const currentExtra = Number(position.performance?.extra ?? 0);

    if (
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !Number.isFinite(principal) ||
      principal < 0 ||
      !Number.isFinite(currentExtra) ||
      currentExtra < 0
    ) {
      throw new CustomError("Position has invalid performance values!", 400);
    }

    let positionCost = Number(position.positionCost);

    if (!Number.isFinite(positionCost) || positionCost <= 0) {
      const averageEntryPrice = Number(position.averageEntryPrice);

      if (
        Number.isFinite(averageEntryPrice) &&
        averageEntryPrice > 0 &&
        quantity > 0
      ) {
        positionCost = quantity * averageEntryPrice;
      }
    }

    // Fallback 2: reconstruct entry cost from the original buy trades.
    if (
      (!Number.isFinite(positionCost) || positionCost <= 0) &&
      quantity > 0 &&
      position.tradeIds?.length
    ) {
      let tradesQuery = Trade.find({
        _id: { $in: position.tradeIds },
        orderType: "buy",
      });

      if (session) tradesQuery = tradesQuery.session(session);

      const originalTrades = await tradesQuery;

      let costTotal = 0;
      let quantityTotal = 0;

      for (const trade of originalTrades) {
        const tradeQuantity = Number(trade.execution?.quantity ?? 0);
        const savedCost = Number(trade.execution?.positionCost ?? 0);
        const savedExposure = Number(trade.execution?.positionAmount ?? 0);
        const entryPrice = Number(trade.execution?.price ?? 0);
        const principalAmount = Number(trade.execution?.amount ?? 0);

        if (!Number.isFinite(tradeQuantity) || tradeQuantity <= 0) {
          continue;
        }

        const entryCost =
          Number.isFinite(savedCost) && savedCost > 0
            ? savedCost
            : Number.isFinite(savedExposure) && savedExposure > 0
              ? savedExposure
              : Number.isFinite(entryPrice) && entryPrice > 0
                ? tradeQuantity * entryPrice
                : principalAmount;

        if (!Number.isFinite(entryCost) || entryCost <= 0) {
          continue;
        }

        costTotal += entryCost;
        quantityTotal += tradeQuantity;
      }

      if (costTotal > 0 && quantityTotal > 0) {
        positionCost = (costTotal / quantityTotal) * quantity;
      }
    }

    // Last-resort legacy fallback. Missing historical entry data means
    // we assume zero market P/L until a proper basis can be recovered.
    if ((!Number.isFinite(positionCost) || positionCost <= 0) && quantity > 0) {
      positionCost = quantity * price;
    }

    if (quantity > 0 && (!Number.isFinite(positionCost) || positionCost <= 0)) {
      throw new CustomError("Unable to determine position entry cost!", 400);
    }

    const currentBaseValue = quantity * price;
    const currentValue = currentBaseValue + currentExtra;

    // Debt is intentionally excluded from P/L.
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

    const todayReturn =
      currentValue -
      (Number.isFinite(previousValue) ? previousValue : currentValue);

    const todayReturnPercent =
      previousValue > 0 ? (todayReturn / previousValue) * 100 : 0;

    if (!position.performance) position.performance = {};

    // Persist recovered cost basis so the fallback is not needed next time.
    if (quantity > 0) {
      position.positionCost = positionCost;
      position.averageEntryPrice = positionCost / quantity;
    }

    position.performance.currentBaseValue = currentBaseValue;
    position.performance.currentValue = currentValue;
    position.performance.currentPrice = price;
    position.performance.extra = currentExtra;

    position.performance.totalReturn = totalReturn;
    position.performance.totalReturnPercent = totalReturnPercent;

    position.performance.todayReturn = todayReturn;
    position.performance.todayReturnPercent = todayReturnPercent;

    position.performance.todayMarketReturn =
      currentBaseValue -
      (Number.isFinite(previousBaseValue)
        ? previousBaseValue
        : currentBaseValue);

    await position.save(session ? { session } : {});

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
      const currentBaseValue = Number(
        position.performance?.currentBaseValue || 0,
      );
      const currentExtra = Number(position.performance?.extra || 0);

      const currentValue =
        Number(position.performance?.currentValue) ||
        currentBaseValue + currentExtra;

      const amountInvested = Number(position.amountInvested || 0);
      const positionCost = Number(
        position.positionCost ?? position.performance?.currentBaseValue ?? 0,
      );

      const totalReturn = currentBaseValue - positionCost + currentExtra;

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
