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

    const EPSILON = 0.000001;
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

      const positionQuantity = Number(position.quantity);
      const positionExtra = Number(position.performance?.extra ?? 0);

      if (
        !Number.isFinite(positionQuantity) ||
        positionQuantity <= 0 ||
        !Number.isFinite(positionExtra) ||
        positionExtra < 0
      ) {
        throw new CustomError("Position has invalid accounting values", 400);
      }

      const positionBaseValue = positionQuantity * currentPrice;
      const totalPositionValue = positionBaseValue + positionExtra;

      if (!Number.isFinite(totalPositionValue) || totalPositionValue <= 0) {
        throw new CustomError("Position has no valid close value", 400);
      }

      if (requestedAmount > totalPositionValue + 0.01) {
        throw new CustomError(
          `Amount exceeds the current position value of ${totalPositionValue.toFixed(2)}`,
          400,
        );
      }

      const effectiveAmount = Math.min(requestedAmount, totalPositionValue);

      // The requested amount is a percentage of market value + bonus.
      let closeRatio =
        effectiveAmount >= totalPositionValue - 0.01
          ? 1
          : effectiveAmount / totalPositionValue;

      if (closeRatio >= 1 - EPSILON) {
        closeRatio = 1;
      }

      const isFullClose = closeRatio === 1;
      const remainingRatio = 1 - closeRatio;
      const now = new Date();

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

      const closedTradesIds = [];

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
        const originalPositionAmount = Number(
          trade.execution?.positionAmount ?? tradeCost,
        );

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

        const tradeBaseValue = tradeQuantity * currentPrice;

        // Apply the same close percentage to every accounting component.
        const actualQuantityRemaining = isFullClose
          ? 0
          : round(tradeQuantity * remainingRatio);

        const actualPrincipalRemaining = isFullClose
          ? 0
          : round(tradePrincipal * remainingRatio);

        const actualCostRemaining = isFullClose
          ? 0
          : round(tradeCost * remainingRatio);

        const actualDebtRemaining = isFullClose
          ? 0
          : round(tradeDebt * remainingRatio);

        const actualBaseRemaining = isFullClose
          ? 0
          : round(tradeBaseValue * remainingRatio);

        const actualExtraRemaining = isFullClose
          ? 0
          : round(tradeBonus * remainingRatio);

        const tradeQuantityClosed = round(
          tradeQuantity - actualQuantityRemaining,
        );
        const tradePrincipalClosed = round(
          tradePrincipal - actualPrincipalRemaining,
        );
        const tradeCostClosed = round(tradeCost - actualCostRemaining);
        const tradeDebtClosed = round(tradeDebt - actualDebtRemaining);
        const tradeBaseClosed = round(tradeBaseValue - actualBaseRemaining);
        const tradeExtraClosed = round(tradeBonus - actualExtraRemaining);

        const tradeCashReturned = round(
          tradeBaseClosed - tradeDebtClosed + tradeExtraClosed,
        );

        const tradeRealizedProfit = round(
          tradeBaseClosed - tradeCostClosed + tradeExtraClosed,
        );

        if (
          !Number.isFinite(tradeCashReturned) ||
          tradeCashReturned < -0.01 ||
          !Number.isFinite(tradeRealizedProfit)
        ) {
          throw new CustomError(
            `Invalid closing proceeds for trade ${trade._id}`,
            400,
          );
        }

        trade.performance = trade.performance ?? {};

        if (isFullClose) {
          trade.status = "closed";
          trade.closedAt = now;
          trade.closeReason = "admin_close";

          trade.execution.quantity = 0;
          trade.execution.amount = 0;
          trade.execution.positionCost = 0;
          trade.execution.marginDebt = 0;

          // Keep positionAmount as historical entry exposure.
          trade.execution.positionAmount = originalPositionAmount;

          trade.extra = 0;

          trade.performance.currentPrice = currentPrice;
          trade.performance.currentBaseValue = 0;
          trade.performance.currentValue = 0;
          trade.performance.totalReturn = tradeRealizedProfit;
          trade.performance.totalReturnPercent =
            tradePrincipal > 0
              ? round((tradeRealizedProfit / tradePrincipal) * 100)
              : 0;

          closedTradesIds.push(trade._id);
        } else {
          trade.execution.quantity = actualQuantityRemaining;
          trade.execution.amount = actualPrincipalRemaining;
          trade.execution.positionCost = actualCostRemaining;
          trade.execution.marginDebt = actualDebtRemaining;

          // Do not replace original entry exposure with remaining cost basis.
          trade.execution.positionAmount = originalPositionAmount;

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
            principalClosed: tradePrincipalClosed,
            profitLossClosed: tradeRealizedProfit,
            closedAt: now,
            remainingPrincipal: actualPrincipalRemaining,
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

      quantityClosed = round(quantityClosed);
      principalClosed = round(principalClosed);
      positionCostClosed = round(positionCostClosed);
      marginDebtRepaid = round(marginDebtRepaid);
      baseValueClosed = round(baseValueClosed);
      extraClosed = round(extraClosed);
      cashReturned = round(cashReturned);
      realizedProfitLoss = round(realizedProfitLoss);

      remainingQuantity = round(remainingQuantity);
      remainingPrincipal = round(remainingPrincipal);
      remainingPositionCost = round(remainingPositionCost);
      remainingMarginDebt = round(remainingMarginDebt);
      remainingBaseValue = round(remainingBaseValue);
      remainingExtra = round(remainingExtra);

      const settledCash = round(Math.max(0, cashReturned));
      const settledProfitLoss = realizedProfitLoss;

      const isAutoPlan = position.wallet?.slug === "auto";

      if (isAutoPlan) {
        const user = await User.findById(position.userId).session(session);

        if (!user) {
          throw new CustomError("User not found for auto-plan settlement", 404);
        }

        const activePlan = user.activePlans?.find(
          (plan) =>
            String(plan.planId) === String(position.planId) &&
            plan.status === "active",
        );

        if (!activePlan) {
          throw new CustomError("Active plan not found for this position", 409);
        }

        activePlan.balance = activePlan.balance ?? {};
        activePlan.balance.available =
          (Number(activePlan.balance.available) || 0) + settledCash;

        activePlan.balance.total =
          (Number(activePlan.balance.total) || 0) + settledProfitLoss;

        if (activePlan.balance.available < -0.01) {
          throw new CustomError(
            "Auto-plan does not have sufficient funds to settle this close",
            409,
          );
        }

        await user.save({ session });
      } else {
        wallet.balance = wallet.balance ?? {};

        wallet.balance.available =
          (Number(wallet.balance.available) || 0) + settledCash;

        wallet.balance.total =
          (Number(wallet.balance.total) || 0) + settledProfitLoss;

        if (wallet.marginDebt !== undefined) {
          wallet.marginDebt = Math.max(
            0,
            (Number(wallet.marginDebt) || 0) - marginDebtRepaid,
          );
        }

        await wallet.save({ session });
      }

      // Rebuild the aggregate position from its remaining open trades.
      position.quantity = remainingQuantity;
      position.amountInvested = remainingPrincipal;
      position.positionCost = remainingPositionCost;
      position.marginDebt = remainingMarginDebt;

      position.performance = position.performance ?? {};
      position.performance.currentPrice = currentPrice;
      position.performance.currentBaseValue = remainingBaseValue;
      position.performance.extra = remainingExtra;
      position.performance.currentValue = remainingBaseValue + remainingExtra;
      position.performance.totalReturn =
        remainingBaseValue - remainingPositionCost + remainingExtra;
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
        position.closedAt = now;
        position.closeReason = "admin_close";

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
          quantityClosed,
          principalClosed,
          positionCostClosed,
          marginDebtRepaid,
          profitLossClosed: settledProfitLoss,
          closedAt: now,
        });
      }

      await position.save({ session });

      const sellTradeRecord = {
        userId: position.userId,
        asset: position.asset,
        planId: position.planId,
        assetType: position.asset.type,
        orderType: "sell",
        wallet: position.wallet,

        execution: {
          price: currentPrice,
          quantity: quantityClosed,
          amount: principalClosed,
          positionAmount: baseValueClosed,
          positionCost: positionCostClosed,
          marginDebt: marginDebtRepaid,
          leverage: Number(position.leverage) || 1,
        },

        targets: {
          takeProfit: null,
          stopLoss: null,
          entryPoint: position.averageEntryPrice,
          exitPoint: currentPrice,
        },

        performance: {
          currentBaseValue: baseValueClosed,
          currentValue: baseValueClosed + extraClosed,
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
        extra: extraClosed,
        fullname: position.fullname,
        positionId: position._id,
        closedTradesIds,
      };

      const [sellTrade] = await Trade.create([sellTradeRecord], { session });

      await session.commitTransaction();
      transactionCommitted = true;

      // Snapshot failures must not invalidate the committed close.
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
            marginDebtRepaid,
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
            marginDebtRepaid,
            cashReturned: settledCash,
            realizedProfitLoss: settledProfitLoss,
          },
        );
      } catch (error) {
        console.error("Wallet snapshot failed after close:", error);
      }

      const updatedPosition = await Position.findById(positionId);

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
          baseValueClosed,
          extraClosed,
          grossValueClosed: round(baseValueClosed + extraClosed),
          principalClosed,
          positionCostClosed,
          marginDebtRepaid,
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

    const round = (value) => Number(Number(value).toFixed(8));

    try {
      session.startTransaction();

      const position = await Position.findById(positionId).session(session);

      if (!position) {
        throw new CustomError("Position not found", 404);
      }

      position.performance = position.performance ?? {};

      if (customDate !== undefined) {
        position.customDate = customDate;
      }

      if (extra !== undefined && extra !== null && extra !== "") {
        if (position.status !== "open") {
          throw new CustomError(
            "Bonus can only be edited on an open position",
            400,
          );
        }

        const parsedExtra = Number(extra);

        if (!Number.isFinite(parsedExtra) || parsedExtra < 0) {
          throw new CustomError(
            "Extra must be a valid non-negative number",
            400,
          );
        }

        const currentExtra = Number(position.performance.extra) || 0;

        extraDifference = parsedExtra - currentExtra;

        if (extraDifference !== 0) {
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

          const trades = await Trade.find({
            _id: { $in: position.tradeIds || [] },
            userId: position.userId,
            "asset.assetId": position.asset.assetId,
            "wallet.id": position.wallet.id,
            orderType: "buy",
            status: "open",
          }).session(session);

          if (trades.length === 0) {
            throw new CustomError(
              "No open buy trades found to allocate the position bonus",
              409,
            );
          }

          const totalInvested = trades.reduce(
            (sum, trade) =>
              sum + Math.max(0, Number(trade.execution?.amount) || 0),
            0,
          );

          let allocatedExtra = 0;

          for (let index = 0; index < trades.length; index++) {
            const trade = trades[index];

            trade.performance = trade.performance ?? {};

            const tradeAmount = Math.max(
              0,
              Number(trade.execution?.amount) || 0,
            );

            let newTradeExtra;

            if (index === trades.length - 1) {
              // Assign the remainder to avoid cumulative allocation drift.
              newTradeExtra = round(parsedExtra - allocatedExtra);
            } else if (totalInvested > 0) {
              newTradeExtra = round(
                parsedExtra * (tradeAmount / totalInvested),
              );

              allocatedExtra += newTradeExtra;
            } else {
              newTradeExtra = round(parsedExtra / trades.length);
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
              Number(trade.execution?.amount) *
                (Number(trade.execution?.leverage) || 1);

            const oldTradeExtra = Number(trade.extra) || 0;
            const tradeExtraDifference = newTradeExtra - oldTradeExtra;

            // Bonus is independent of leverage.
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

            // Do not change quantity, leverage, positionAmount, positionCost,
            // marginDebt, or user-funded principal when editing bonus.
            await trade.save({ session });
          }

          shouldCreateSnapshots = true;

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

      await position.save({ session });
      updatedPosition = position;

      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error("Failed to abort position edit:", abortError);
        }
      }

      if (error instanceof CustomError) {
        throw error;
      }

      console.error("editPositionData error:", error);

      throw new CustomError(error.message || "Failed to update position", 500);
    } finally {
      await session.endSession();
    }

    // Snapshots are secondary and run after the transaction commits.
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

      const results = await Promise.allSettled(
        snapshotTasks.map((task) => task.run()),
      );

      results.forEach((result, index) => {
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
