const { default: mongoose } = require("mongoose");
const Position = require("../../models/Position");
const { CustomError } = require("../../utils/utils");
const portfolioService = require("../user/portfolioService");
const Wallet = require("../../models/Wallet");
const Asset = require("../../models/Asset");
const Trade = require("../../models/Trade");
const positionService = require("../user/positionService");
const User = require("../../models/User");
const walletSnapshotService = require("../user/walletSnapshotService");

const {
  calculateMarketValue,
  calculatePartialClose,
  calculateRealizedProfit,
  calculateReturnPercent,
  hasNoRemainingExposure,
} = require("../../utils/trading/positionCalculation");

class ManagePositionService {
  async fetchAllPositions(queryData) {
    const { sortBy } = queryData;

    const sort = {};

    if (sortBy) {
      sort.createdAt = -1;
    }

    const positions = await Position.find().sort(sort).lean();
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
      throw new CustomError("Position ID is required", 400);
    }

    const requestedAmount = Number(amount);

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new CustomError("Amount must be a valid positive number", 400);
    }

    const session = await mongoose.startSession();
    let transactionCommitted = false;

    const AMOUNT_EPSILON = 0.01;
    const RATIO_EPSILON = 0.000001;

    const round = (value) => Number(Number(value).toFixed(8));

    try {
      session.startTransaction();

      const position = await Position.findById(positionId).session(session);

      if (!position) {
        throw new CustomError("Position not found", 404);
      }

      if (position.status === "closed") {
        await session.abortTransaction();

        return {
          success: true,
          message: "Position is already closed",
          alreadyClosed: true,
          position,
        };
      }

      if (position.status !== "open") {
        throw new CustomError("Position is not open", 400);
      }

      const wallet = await Wallet.findById(position.wallet?.id).session(
        session,
      );

      if (!wallet) {
        throw new CustomError("Wallet not found", 404);
      }

      const asset = await Asset.findById(position.asset?.assetId).session(
        session,
      );

      if (!asset) {
        throw new CustomError("Asset not found", 404);
      }

      const currentPrice = Number(asset.priceData?.current);

      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        throw new CustomError("Invalid current asset price", 400);
      }

      // Load every open buy trade belonging to this position.
      const trades = await Trade.find({
        _id: { $in: position.tradeIds || [] },
        userId: position.userId,
        "asset.assetId": position.asset.assetId,
        "wallet.id": position.wallet.id,
        orderType: "buy",
        status: "open",
      }).session(session);

      if (!trades.length) {
        throw new CustomError(
          "Position has no open buy trades. Reconcile its trade history before closing.",
          409,
        );
      }

      // Validate the position's accounting values.
      const quantity = Number(position.quantity);
      const amountInvested = Number(position.amountInvested);
      const positionCost = Number(position.positionCost);
      const marginDebt = Number(position.marginDebt ?? 0);
      const positionExtra = Number(position.performance?.extra ?? 0);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(amountInvested) ||
        amountInvested < 0 ||
        !Number.isFinite(positionCost) ||
        positionCost < 0 ||
        !Number.isFinite(marginDebt) ||
        marginDebt < 0 ||
        !Number.isFinite(positionExtra) ||
        positionExtra < 0
      ) {
        throw new CustomError("Position has invalid accounting values", 400);
      }

      const positionBaseValue = calculateMarketValue(quantity, currentPrice);
      const totalPositionValue = positionBaseValue + positionExtra;

      if (!Number.isFinite(totalPositionValue) || totalPositionValue <= 0) {
        throw new CustomError("Position has no valid close value", 400);
      }

      if (requestedAmount > totalPositionValue + AMOUNT_EPSILON) {
        throw new CustomError(
          `Amount exceeds the current position value of ${totalPositionValue.toFixed(2)}`,
          400,
        );
      }

      const effectiveAmount = Math.min(requestedAmount, totalPositionValue);

      let closeRatio =
        effectiveAmount >= totalPositionValue - AMOUNT_EPSILON
          ? 1
          : effectiveAmount / totalPositionValue;

      if (closeRatio >= 1 - RATIO_EPSILON) {
        closeRatio = 1;
      }

      const isFullClose = closeRatio === 1;
      const remainingRatio = 1 - closeRatio;
      const now = new Date();

      /*
       * Allocate the close across each open buy trade.
       *
       * Wallet cash returned and realized P&L are calculated from the
       * individual trade close results, avoiding double-crediting the
       * position-level and trade-level values.
       */
      let quantityClosed = 0;
      let principalClosed = 0;
      let positionCostClosed = 0;
      let marginDebtRepaid = 0;
      let baseValueClosed = 0;
      let extraClosed = 0;
      let cashReturned = 0;
      let realizedProfitLoss = 0;

      let remainingQuantity = 0;
      let remainingPrincipal = 0;
      let remainingPositionCost = 0;
      let remainingMarginDebt = 0;
      let remainingBaseValue = 0;
      let remainingExtra = 0;

      const closedTrades = [];

      for (const trade of trades) {
        const tradeQuantity = Number(trade.execution?.quantity);
        const tradePrincipal = Number(trade.execution?.amount);
        const tradeCost = Number(
          trade.execution?.positionCost ??
            trade.execution?.positionAmount ??
            trade.execution?.amount,
        );
        const tradeDebt = Number(trade.execution?.marginDebt ?? 0);
        const tradeBonus = Number(trade.extra ?? 0);

        if (
          !Number.isFinite(tradeQuantity) ||
          tradeQuantity <= 0 ||
          !Number.isFinite(tradePrincipal) ||
          tradePrincipal < 0 ||
          !Number.isFinite(tradeCost) ||
          tradeCost < 0 ||
          !Number.isFinite(tradeDebt) ||
          tradeDebt < 0 ||
          !Number.isFinite(tradeBonus) ||
          tradeBonus < 0
        ) {
          throw new CustomError(
            `Invalid execution values for trade ${trade._id}`,
            400,
          );
        }

        const tradeBaseValue = calculateMarketValue(
          tradeQuantity,
          currentPrice,
        );

        const closing = calculatePartialClose({
          quantity: tradeQuantity,
          principal: tradePrincipal,
          positionCost: tradeCost,
          marginDebt: tradeDebt,
          baseValue: tradeBaseValue,
          extra: tradeBonus,
          closeRatio,
        });

        const {
          quantityRemaining,
          principalRemaining,
          positionCostRemaining,
          marginDebtRemaining,
          baseValueRemaining,
          extraRemaining,
          totalProceeds,
          realizedProfit,
        } = closing;

        const tradeIsFullyClosed =
          isFullClose ||
          hasNoRemainingExposure({
            quantity: quantityRemaining,
            principal: principalRemaining,
            positionCost: positionCostRemaining,
            marginDebt: marginDebtRemaining,
            currentBaseValue: baseValueRemaining,
            extra: extraRemaining,
          });

        const actualQuantityRemaining = tradeIsFullyClosed
          ? 0
          : quantityRemaining;
        const actualPrincipalRemaining = tradeIsFullyClosed
          ? 0
          : principalRemaining;
        const actualCostRemaining = tradeIsFullyClosed
          ? 0
          : positionCostRemaining;
        const actualDebtRemaining = tradeIsFullyClosed
          ? 0
          : marginDebtRemaining;
        const actualBaseRemaining = tradeIsFullyClosed ? 0 : baseValueRemaining;
        const actualExtraRemaining = tradeIsFullyClosed ? 0 : extraRemaining;

        const tradeQuantityClosed = tradeQuantity - actualQuantityRemaining;
        const tradePrincipalClosed = tradePrincipal - actualPrincipalRemaining;
        const tradeCostClosed = tradeCost - actualCostRemaining;
        const tradeDebtClosed = tradeDebt - actualDebtRemaining;
        const tradeBaseClosed = tradeBaseValue - actualBaseRemaining;
        const tradeExtraClosed = tradeBonus - actualExtraRemaining;

        /*
         * Calculate cash returned using the actual amounts removed from
         * the trade, so rounding and dust cleanup do not create a mismatch.
         */
        const tradeCashReturned =
          tradeBaseClosed - tradeDebtClosed + tradeExtraClosed;

        const tradeRealizedProfit =
          tradeBaseClosed - tradeCostClosed + tradeExtraClosed;

        if (
          !Number.isFinite(tradeCashReturned) ||
          tradeCashReturned < -AMOUNT_EPSILON ||
          !Number.isFinite(tradeRealizedProfit)
        ) {
          throw new CustomError(
            `Invalid closing proceeds for trade ${trade._id}`,
            400,
          );
        }

        trade.performance = trade.performance ?? {};

        if (tradeIsFullyClosed) {
          trade.status = "closed";
          trade.closedAt = now;
          trade.closeReason = "admin_close";

          trade.execution.quantity = 0;
          trade.execution.amount = 0;
          trade.execution.positionAmount = 0;
          trade.execution.positionCost = 0;
          trade.execution.marginDebt = 0;

          trade.extra = 0;

          trade.performance.currentPrice = currentPrice;
          trade.performance.currentBaseValue = 0;
          trade.performance.currentValue = 0;
          trade.performance.totalReturn = round(tradeRealizedProfit);
          trade.performance.totalReturnPercent =
            tradePrincipal > 0
              ? round((tradeRealizedProfit / tradePrincipal) * 100)
              : 0;

          closedTrades.push(trade);
        } else {
          trade.execution.quantity = actualQuantityRemaining;
          trade.execution.amount = actualPrincipalRemaining;
          trade.execution.positionAmount = actualCostRemaining;
          trade.execution.positionCost = actualCostRemaining;
          trade.execution.marginDebt = actualDebtRemaining;

          trade.extra = actualExtraRemaining;

          const remainingProfit =
            actualBaseRemaining - actualCostRemaining + actualExtraRemaining;

          trade.performance.currentPrice = currentPrice;
          trade.performance.currentBaseValue = actualBaseRemaining;
          trade.performance.currentValue =
            actualBaseRemaining + actualExtraRemaining;
          trade.performance.totalReturn = round(remainingProfit);
          trade.performance.totalReturnPercent =
            actualPrincipalRemaining > 0
              ? round((remainingProfit / actualPrincipalRemaining) * 100)
              : 0;

          trade.performance.todayMarketReturn =
            (Number(trade.performance.todayMarketReturn) || 0) * remainingRatio;

          trade.performance.todayExtra =
            (Number(trade.performance.todayExtra) || 0) * remainingRatio;

          trade.performance.todayReturn =
            trade.performance.todayMarketReturn + trade.performance.todayExtra;

          trade.performance.todayReturnPercent =
            actualPrincipalRemaining > 0
              ? round(
                  (trade.performance.todayReturn / actualPrincipalRemaining) *
                    100,
                )
              : 0;

          if (!Array.isArray(trade.partialCloses)) {
            trade.partialCloses = [];
          }

          trade.partialCloses.push({
            percentClosed: closeRatio * 100,
            principalClosed: round(tradePrincipalClosed),
            profitLossClosed: round(tradeRealizedProfit),
            closedAt: now,
            remainingPrincipal: round(actualPrincipalRemaining),
            remainingProfitLoss: round(remainingProfit),
          });
        }

        await trade.save({ session });

        quantityClosed += tradeQuantityClosed;
        principalClosed += tradePrincipalClosed;
        positionCostClosed += tradeCostClosed;
        marginDebtRepaid += tradeDebtClosed;
        baseValueClosed += tradeBaseClosed;
        extraClosed += tradeExtraClosed;
        cashReturned += tradeCashReturned;
        realizedProfitLoss += tradeRealizedProfit;

        remainingQuantity += actualQuantityRemaining;
        remainingPrincipal += actualPrincipalRemaining;
        remainingPositionCost += actualCostRemaining;
        remainingMarginDebt += actualDebtRemaining;
        remainingBaseValue += actualBaseRemaining;
        remainingExtra += actualExtraRemaining;
      }

      /*
       * Apply wallet accounting once.
       *
       * available: credit the actual net cash returned.
       * total:     credit realized P&L only, because buy only deducted
       *            the principal from available, not from total.
       */
      const settledCash = round(Math.max(0, cashReturned));
      const settledProfitLoss = round(realizedProfitLoss);

      wallet.balance = wallet.balance ?? {};

      wallet.balance.available =
        (Number(wallet.balance.available) || 0) + settledCash;

      wallet.balance.total =
        (Number(wallet.balance.total) || 0) + settledProfitLoss;

      // Reduce the wallet's outstanding debt if this wallet tracks it.
      if (wallet.marginDebt !== undefined) {
        wallet.marginDebt = Math.max(
          0,
          (Number(wallet.marginDebt) || 0) + 0 - round(marginDebtRepaid),
        );
      }

      await wallet.save({ session });

      /*
       * Update the position from the remaining open buy trades' accounting
       * totals. Do not call updatePosition() here as well; the trades and
       * wallet have already been updated in this transaction.
       */
      position.quantity = round(remainingQuantity);
      position.amountInvested = round(remainingPrincipal);
      position.positionCost = round(remainingPositionCost);
      position.marginDebt = round(remainingMarginDebt);

      position.performance = position.performance ?? {};
      position.performance.currentPrice = currentPrice;
      position.performance.currentBaseValue = round(remainingBaseValue);
      position.performance.extra = round(remainingExtra);
      position.performance.currentValue = round(
        remainingBaseValue + remainingExtra,
      );
      position.performance.totalReturn = round(
        remainingBaseValue - remainingPositionCost + remainingExtra,
      );
      position.performance.totalReturnPercent =
        remainingPrincipal > 0
          ? round((position.performance.totalReturn / remainingPrincipal) * 100)
          : 0;

      position.performance.todayMarketReturn =
        (Number(position.performance.todayMarketReturn) || 0) * remainingRatio;

      position.performance.todayExtra =
        (Number(position.performance.todayExtra) || 0) * remainingRatio;

      position.performance.todayReturn =
        position.performance.todayMarketReturn +
        position.performance.todayExtra;

      position.performance.todayReturnPercent =
        remainingPrincipal > 0
          ? round((position.performance.todayReturn / remainingPrincipal) * 100)
          : 0;

      const noRemainingExposure =
        isFullClose ||
        hasNoRemainingExposure({
          quantity: remainingQuantity,
          principal: remainingPrincipal,
          positionCost: remainingPositionCost,
          marginDebt: remainingMarginDebt,
          currentBaseValue: remainingBaseValue,
          extra: remainingExtra,
        });

      if (noRemainingExposure) {
        position.status = "closed";
        position.quantity = 0;
        position.amountInvested = 0;
        position.positionCost = 0;
        position.marginDebt = 0;

        position.performance.currentBaseValue = 0;
        position.performance.currentValue = 0;
        position.performance.extra = 0;
      } else {
        if (!Array.isArray(position.partialCloses)) {
          position.partialCloses = [];
        }

        position.partialCloses.push({
          quantityClosed: round(quantityClosed),
          principalClosed: round(principalClosed),
          positionCostClosed: round(positionCostClosed),
          marginDebtRepaid: round(marginDebtRepaid),
          profitLossClosed: settledProfitLoss,
          closedAt: now,
        });
      }

      await position.save({ session });

      /*
       * Create a closed sell record for this close operation.
       * The sell record is a historical record; it does not trigger another
       * wallet credit or another position update.
       */
      const sellTradeRecord = {
        userId: position.userId,
        asset: position.asset,
        planId: position.planId,
        assetType: position.asset.type,
        orderType: "sell",
        wallet: position.wallet,

        execution: {
          price: currentPrice,
          quantity: round(quantityClosed),
          amount: round(principalClosed),
          positionAmount: round(baseValueClosed),
          positionCost: round(positionCostClosed),
          marginDebt: round(marginDebtRepaid),
          leverage: Number(position.leverage) || 1,
        },

        targets: {
          takeProfit: null,
          stopLoss: null,
          entryPoint: position.averageEntryPrice,
          exitPoint: currentPrice,
        },

        performance: {
          currentBaseValue: round(baseValueClosed),
          currentValue: round(baseValueClosed + extraClosed),
          currentPrice,
          totalReturn: settledProfitLoss,
          totalReturnPercent:
            principalClosed > 0
              ? round((settledProfitLoss / principalClosed) * 100)
              : 0,
          todayReturn: 0,
          todayReturnPercent: 0,
        },

        status: "closed",
        closedAt: now,
        closeReason: "admin_close",
        extra: round(extraClosed),
        fullname: position.fullname,
        positionId: position._id,
        closedTradesIds: closedTrades.map((trade) => trade._id),
      };

      const [sellTrade] = await Trade.create([sellTradeRecord], { session });

      const updatedPosition =
        await Position.findById(positionId).session(session);

      await session.commitTransaction();
      transactionCommitted = true;

      // Secondary snapshots must not invalidate a committed financial close.
      try {
        await portfolioService.createPortfolioSnapshot(
          position.userId,
          "trade_sell",
          {
            tradeId: sellTrade._id,
            positionId: position._id,
            assetSymbol: position.asset.symbol,
            closeRatio,
            grossValueClosed: round(baseValueClosed + extraClosed),
            marginDebtRepaid: round(marginDebtRepaid),
            cashReturned: settledCash,
            realizedProfitLoss: settledProfitLoss,
          },
        );
      } catch (error) {
        console.error("Portfolio snapshot failed after close:", error);
      }

      try {
        await walletSnapshotService.createWalletSnapshot(
          position.wallet.id,
          "trade_sell",
          {
            tradeId: sellTrade._id,
            positionId: position._id,
            assetSymbol: position.asset.symbol,
            closeRatio,
            grossValueClosed: round(baseValueClosed + extraClosed),
            marginDebtRepaid: round(marginDebtRepaid),
            cashReturned: settledCash,
            realizedProfitLoss: settledProfitLoss,
          },
        );
      } catch (error) {
        console.error("Wallet snapshot failed after close:", error);
      }

      return {
        success: true,
        message: noRemainingExposure
          ? "Position closed successfully"
          : "Position partially closed successfully",
        position: updatedPosition,
        sellTrade,
        close: {
          closeRatio,
          closePercentage: closeRatio * 100,
          baseValueClosed: round(baseValueClosed),
          extraClosed: round(extraClosed),
          grossValueClosed: round(baseValueClosed + extraClosed),
          principalClosed: round(principalClosed),
          positionCostClosed: round(positionCostClosed),
          marginDebtRepaid: round(marginDebtRepaid),
          profitLoss: settledProfitLoss,
          cashReturned: settledCash,
        },
      };
    } catch (error) {
      if (!transactionCommitted && session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error("Failed to abort close transaction:", abortError);
        }
      }

      console.error("Failed to close position:", error);

      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(
        error.message || "Failed to close position",
        error.statusCode || 500,
      );
    } finally {
      await session.endSession();
    }
  }

  async editPositionData(positionData) {
    const { positionId, customDate, extra } = positionData;

    if (!positionId) {
      throw new CustomError("Position ID is required", 400);
    }

    const session = await mongoose.startSession();

    let updatedPosition;
    let shouldCreateSnapshots = false;
    let extraDifference = 0;
    let snapshotMetadata = null;
    let userId;
    let walletId;

    try {
      session.startTransaction();

      const position = await Position.findById(positionId).session(session);

      if (!position) {
        throw new CustomError("Position not found", 404);
      }

      if (!position.performance) {
        position.performance = {};
      }

      // --------------------------------------------------
      // 1. CUSTOM DATE
      // --------------------------------------------------

      if (customDate !== undefined) {
        position.customDate = customDate;
      }

      // --------------------------------------------------
      // 2. EDIT BONUS / EXTRA
      // --------------------------------------------------

      if (extra !== undefined && extra !== null && extra !== "") {
        const parsedExtra = Number(extra);

        if (!Number.isFinite(parsedExtra)) {
          throw new CustomError("Extra must be a valid number", 400);
        }

        if (parsedExtra < 0) {
          throw new CustomError("Extra cannot be negative", 400);
        }

        const currentExtra = Number(position.performance.extra) || 0;

        extraDifference = parsedExtra - currentExtra;

        if (extraDifference !== 0) {
          shouldCreateSnapshots = true;

          const quantity = Number(position.quantity) || 0;

          let currentPrice = Number(position.performance.currentPrice) || 0;

          if (currentPrice <= 0) {
            currentPrice = Number(position.asset?.priceData?.current) || 0;
          }

          if (currentPrice <= 0) {
            currentPrice = Number(position.averageEntryPrice) || 0;
          }

          if (quantity <= 0 || currentPrice <= 0) {
            throw new CustomError(
              "Cannot update bonus because the position price or quantity is invalid",
              400,
            );
          }

          // --------------------------------------------------
          // 3. RECOMPUTE POSITION VALUES
          // --------------------------------------------------

          const currentBaseValue = quantity * currentPrice;
          const amountInvested = Number(position.amountInvested) || 0;

          const positionCost =
            Number(position.positionCost) ||
            quantity * (Number(position.averageEntryPrice) || 0);

          position.performance.extra = parsedExtra;
          position.performance.currentPrice = currentPrice;
          position.performance.currentBaseValue = currentBaseValue;
          position.performance.currentValue = currentBaseValue + parsedExtra;

          position.performance.totalReturn =
            currentBaseValue - positionCost + parsedExtra;

          position.performance.totalReturnPercent =
            amountInvested > 0
              ? (position.performance.totalReturn / amountInvested) * 100
              : 0;

          // --------------------------------------------------
          // 4. UPDATE TODAY'S RETURN
          // --------------------------------------------------

          position.performance.todayExtra =
            (Number(position.performance.todayExtra) || 0) + extraDifference;

          position.performance.todayMarketReturn =
            Number(position.performance.todayMarketReturn) || 0;

          position.performance.todayReturn =
            position.performance.todayMarketReturn +
            position.performance.todayExtra;

          position.performance.todayReturnPercent =
            amountInvested > 0
              ? (position.performance.todayReturn / amountInvested) * 100
              : 0;

          // --------------------------------------------------
          // 5. DISTRIBUTE BONUS TO OPEN TRADES
          // --------------------------------------------------

          const trades = await Trade.find({
            _id: { $in: position.tradeIds || [] },
            status: "open",
          }).session(session);

          if (trades.length > 0) {
            const totalInvested = trades.reduce(
              (sum, trade) => sum + (Number(trade.execution?.amount) || 0),
              0,
            );

            let allocatedExtra = 0;

            for (let index = 0; index < trades.length; index++) {
              const trade = trades[index];

              if (!trade.performance) {
                trade.performance = {};
              }

              const tradeAmount = Number(trade.execution?.amount) || 0;

              // Allocate according to user-funded capital.
              // The last trade receives the rounding remainder.
              let newTradeExtra;

              if (index === trades.length - 1) {
                newTradeExtra = parsedExtra - allocatedExtra;
              } else if (totalInvested > 0) {
                newTradeExtra = parsedExtra * (tradeAmount / totalInvested);

                allocatedExtra += newTradeExtra;
              } else {
                newTradeExtra = parsedExtra / trades.length;
                allocatedExtra += newTradeExtra;
              }

              const tradeQuantity = Number(trade.execution?.quantity) || 0;

              const tradePrice =
                Number(trade.performance.currentPrice) ||
                Number(trade.execution?.price) ||
                currentPrice;

              const tradeBaseValue = tradeQuantity * tradePrice;

              const tradePositionCost =
                Number(trade.execution?.positionCost) ||
                Number(trade.execution?.positionAmount) ||
                tradeQuantity * (Number(trade.execution?.price) || 0);

              const oldTradeExtra = Number(trade.extra) || 0;

              const tradeExtraDifference = newTradeExtra - oldTradeExtra;

              // Bonus is stored at the root of the Trade.
              trade.extra = newTradeExtra;

              trade.performance.currentPrice = tradePrice;
              trade.performance.currentBaseValue = tradeBaseValue;
              trade.performance.currentValue = tradeBaseValue + newTradeExtra;

              trade.performance.totalReturn =
                tradeBaseValue - tradePositionCost + newTradeExtra;

              trade.performance.totalReturnPercent =
                tradeAmount > 0
                  ? (trade.performance.totalReturn / tradeAmount) * 100
                  : 0;

              // Apply only the change in bonus to today's bonus return.
              trade.performance.todayExtra =
                (Number(trade.performance.todayExtra) || 0) +
                tradeExtraDifference;

              trade.performance.todayMarketReturn =
                Number(trade.performance.todayMarketReturn) || 0;

              trade.performance.todayReturn =
                trade.performance.todayMarketReturn +
                trade.performance.todayExtra;

              trade.performance.todayReturnPercent =
                tradeAmount > 0
                  ? (trade.performance.todayReturn / tradeAmount) * 100
                  : 0;

              await trade.save({ session });
            }
          }

          snapshotMetadata = {
            positionId: position._id,
            assetSymbol: position.asset?.symbol,
            extraAmount: extraDifference,
            updatedExtra: position.performance.extra,
          };

          userId = position.userId;
          walletId = position.wallet?.id;
        }
      }

      // --------------------------------------------------
      // 6. SAVE POSITION
      // --------------------------------------------------

      await position.save({ session });

      // Keep a reference to the committed result.
      updatedPosition = position;

      // --------------------------------------------------
      // 7. COMMIT FINANCIAL CHANGES FIRST
      // --------------------------------------------------

      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      if (error instanceof CustomError) {
        throw error;
      }

      console.error("editPositionData error:", error);

      throw new CustomError(error.message || "Failed to update position", 500);
    } finally {
      await session.endSession();
    }

    // --------------------------------------------------
    // 8. CREATE SNAPSHOTS AFTER COMMIT
    // Snapshot failures must not fail the position edit.
    // --------------------------------------------------

    if (shouldCreateSnapshots && snapshotMetadata) {
      const snapshotTasks = [
        {
          name: "portfolio snapshot",
          run: () =>
            portfolioService.createPortfolioSnapshot(
              userId,
              "extra_bonus",
              snapshotMetadata,
            ),
        },
        {
          name: "wallet snapshot",
          run: () =>
            walletSnapshotService.createWalletSnapshot(
              walletId,
              "extra_bonus",
              snapshotMetadata,
            ),
        },
      ];

      const snapshotResults = await Promise.allSettled(
        snapshotTasks.map((task) => task.run()),
      );

      snapshotResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `editPositionData ${snapshotTasks[index].name} failed:`,
            result.reason,
          );
        }
      });
    }

    return updatedPosition;
  }

  async deletePosition(positionId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const position = await Position.findById(positionId).session(session);
      if (!position) throw new CustomError("Position not found!", 404);

      const trades = await Trade.find({
        _id: { $in: position.tradeIds },
      }).session(session);

      if (trades.length === 0) {
        const deletedPosition =
          await Position.findByIdAndDelete(positionId).session(session);
        if (!deletedPosition) throw new CustomError("Position not found!", 404);

        await session.commitTransaction();
        session.endSession();
        return true;
      }

      const [user, wallet] = await Promise.all([
        await User.findById(position.userId).session(session),
        await Wallet.findById(position.wallet.id).session(session),
      ]);
      if (!user) throw new CustomError("User not found!", 404);
      if (!wallet) throw new CustomError("Wallet not found!", 404);

      const userPlans = user.activePlans;

      for (const trade of trades) {
        if (trade.planId) {
          const plan = userPlans.find((pl) => pl.planId === trade.planId);
          plan.balance.available += trade.execution.amount;
        } else {
          wallet.balance.available += trade.execution.amount;
        }
      }

      await user.save({ session });
      await wallet.save({ session });

      const deletedPosition =
        await Position.findByIdAndDelete(positionId).session(session);
      if (!deletedPosition) throw new CustomError("Position not found!", 404);

      await Trade.deleteMany({
        _id: { $in: deletedPosition.tradeIds },
      }).session(session);

      await session.commitTransaction();
      session.endSession();

      return true;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = new ManagePositionService();
