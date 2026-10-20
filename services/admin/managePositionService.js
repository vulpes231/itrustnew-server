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

    const closeAmount = Number(amount);

    if (!Number.isFinite(closeAmount) || closeAmount <= 0) {
      throw new CustomError("Amount must be a valid positive number", 400);
    }

    const session = await mongoose.startSession();
    let transactionCommitted = false;

    try {
      let closeResult;

      session.startTransaction();

      // --------------------------------------------------
      // 1. LOAD AND VALIDATE THE POSITION
      // --------------------------------------------------

      const position = await Position.findById(positionId).session(session);

      if (!position) {
        throw new CustomError("Position not found", 404);
      }

      if (position.status !== "open") {
        throw new CustomError("Position is not open", 400);
      }

      const wallet = await Wallet.findById(position.wallet.id).session(session);

      if (!wallet) {
        throw new CustomError("Wallet not found", 404);
      }

      const asset = await Asset.findById(position.asset.assetId).session(
        session,
      );

      if (!asset) {
        throw new CustomError("Asset not found", 404);
      }

      const currentPrice = Number(asset.priceData?.current);

      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        throw new CustomError("Invalid current asset price", 400);
      }

      const quantity = Number(position.quantity);
      const amountInvested = Number(position.amountInvested) || 0;

      const positionCost = Number(
        position.positionCost ??
          quantity * Number(position.averageEntryPrice ?? 0),
      );

      const marginDebt = Number(position.marginDebt) || 0;
      const positionExtra = Number(position.performance?.extra) || 0;

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

      // Market value excludes bonus.
      const positionBaseValue = quantity * currentPrice;

      // The requested withdrawal amount includes bonus.
      const totalPositionValue = positionBaseValue + positionExtra;

      if (!Number.isFinite(totalPositionValue) || totalPositionValue <= 0) {
        throw new CustomError("Position has no valid close value", 400);
      }

      if (closeAmount > totalPositionValue + 0.000001) {
        throw new CustomError(
          `Amount exceeds the current position value of ${totalPositionValue}`,
          400,
        );
      }

      // --------------------------------------------------
      // 2. CALCULATE THE PROPORTIONAL CLOSE
      // --------------------------------------------------

      let closeRatio = Math.min(1, closeAmount / totalPositionValue);

      if (closeRatio >= 0.999999) {
        closeRatio = 1;
      }

      const remainingRatio = 1 - closeRatio;
      const isFullClose = closeRatio === 1;

      const quantityToClose = quantity * closeRatio;
      const principalToClose = amountInvested * closeRatio;
      const positionCostToClose = positionCost * closeRatio;
      const marginDebtToClose = marginDebt * closeRatio;

      const baseValueToClose = positionBaseValue * closeRatio;
      const extraToClose = positionExtra * closeRatio;
      const totalValueToClose = baseValueToClose + extraToClose;

      const profitLossFromBase = baseValueToClose - positionCostToClose;

      const totalProfitLoss = profitLossFromBase + extraToClose;

      const totalReturnPercent =
        principalToClose > 0 ? (totalProfitLoss / principalToClose) * 100 : 0;

      // --------------------------------------------------
      // 3. LOAD THE OPEN TRADES CONTRIBUTING TO THIS POSITION
      // --------------------------------------------------

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
          "No open buy trades found for this position",
          404,
        );
      }

      // --------------------------------------------------
      // 4. SETTLE WALLET CASH ONCE
      // --------------------------------------------------

      // Sale proceeds exclude bonus. Repay the allocated margin debt.
      // This preserves your existing rule that the allocated bonus
      // is included in the cash returned on close.
      const cashReturned = baseValueToClose - marginDebtToClose + extraToClose;

      if (cashReturned < -0.000001) {
        throw new CustomError(
          "Close proceeds are insufficient to repay margin debt",
          400,
        );
      }

      const settledCash = Math.max(0, cashReturned);

      wallet.balance = wallet.balance || {};

      wallet.balance.total = (Number(wallet.balance.total) || 0) + settledCash;

      wallet.balance.available =
        (Number(wallet.balance.available) || 0) + settledCash;

      if (wallet.marginDebt !== undefined) {
        wallet.marginDebt = Math.max(
          0,
          (Number(wallet.marginDebt) || 0) - marginDebtToClose,
        );
      }

      await wallet.save({ session });

      // --------------------------------------------------
      // 5. UPDATE EACH CONTRIBUTING TRADE PROPORTIONALLY
      // --------------------------------------------------

      const closedTrades = [];
      const updatedTrades = [];
      const now = new Date();

      for (const trade of trades) {
        const tradeQuantity = Number(trade.execution?.quantity) || 0;
        const tradeAmount = Number(trade.execution?.amount) || 0;

        const tradePositionCost = Number(
          trade.execution?.positionCost ??
            trade.execution?.positionAmount ??
            tradeAmount,
        );

        const tradeMarginDebt = Number(trade.execution?.marginDebt) || 0;
        const tradeExtra = Number(trade.extra) || 0;

        if (
          !Number.isFinite(tradeQuantity) ||
          tradeQuantity <= 0 ||
          !Number.isFinite(tradeAmount) ||
          tradeAmount < 0 ||
          !Number.isFinite(tradePositionCost) ||
          tradePositionCost < 0 ||
          !Number.isFinite(tradeMarginDebt) ||
          tradeMarginDebt < 0
        ) {
          throw new CustomError(
            `Invalid execution values for trade ${trade._id}`,
            400,
          );
        }

        // Apply the same ratio to each contributing trade.
        const tradeQuantityToClose = tradeQuantity * closeRatio;
        const tradeAmountToClose = tradeAmount * closeRatio;
        const tradeCostToClose = tradePositionCost * closeRatio;
        const tradeDebtToClose = tradeMarginDebt * closeRatio;
        const tradeExtraToClose = tradeExtra * closeRatio;

        const tradeBaseValue = tradeQuantity * currentPrice;
        const tradeBaseValueToClose = tradeBaseValue * closeRatio;

        const tradeValueToClose = tradeBaseValueToClose + tradeExtraToClose;

        const tradeProfitLoss =
          tradeBaseValueToClose - tradeCostToClose + tradeExtraToClose;

        const tradeIsFullyClosed = isFullClose || remainingRatio < 0.000001;

        if (tradeIsFullyClosed) {
          trade.status = "closed";
          trade.closedAt = now;

          // Preserve original execution values for the audit trail.
          // The separate sell record represents the closed portion.
          trade.performance.currentBaseValue = tradeBaseValueToClose;
          trade.performance.currentValue = tradeValueToClose;
          trade.performance.currentPrice = currentPrice;
          trade.performance.totalReturn = tradeProfitLoss;

          trade.performance.totalReturnPercent =
            tradeAmountToClose > 0
              ? (tradeProfitLoss / tradeAmountToClose) * 100
              : 0;

          closedTrades.push(trade);
        } else {
          const remainingQuantity = tradeQuantity * remainingRatio;
          const remainingAmount = tradeAmount * remainingRatio;
          const remainingCost = tradePositionCost * remainingRatio;
          const remainingDebt = tradeMarginDebt * remainingRatio;
          const remainingExtra = tradeExtra * remainingRatio;
          const remainingBaseValue = tradeBaseValue * remainingRatio;

          const remainingReturn =
            remainingBaseValue - remainingCost + remainingExtra;

          // Preserve leverage metadata while adjusting this trade's
          // remaining capital, exposure, debt, and quantity.
          trade.execution.quantity = remainingQuantity;
          trade.execution.amount = remainingAmount;
          trade.execution.positionAmount = remainingCost;
          trade.execution.positionCost = remainingCost;
          trade.execution.marginDebt = remainingDebt;

          trade.extra = remainingExtra;

          trade.performance.currentBaseValue = remainingBaseValue;
          trade.performance.currentValue = remainingBaseValue + remainingExtra;
          trade.performance.currentPrice = currentPrice;
          trade.performance.totalReturn = remainingReturn;

          trade.performance.totalReturnPercent =
            remainingAmount > 0 ? (remainingReturn / remainingAmount) * 100 : 0;

          // Recalculate daily fields using their remaining proportions.
          const remainingTodayMarketReturn =
            (Number(trade.performance.todayMarketReturn) || 0) * remainingRatio;

          const remainingTodayExtra =
            (Number(trade.performance.todayExtra) || 0) * remainingRatio;

          trade.performance.todayMarketReturn = remainingTodayMarketReturn;
          trade.performance.todayExtra = remainingTodayExtra;

          trade.performance.todayReturn =
            remainingTodayMarketReturn + remainingTodayExtra;

          trade.performance.todayReturnPercent =
            remainingAmount > 0
              ? (trade.performance.todayReturn / remainingAmount) * 100
              : 0;

          if (!trade.partialCloses) {
            trade.partialCloses = [];
          }

          // Only schema-supported partialCloses fields are persisted.
          trade.partialCloses.push({
            percentClosed: closeRatio * 100,
            principalClosed: tradeAmountToClose,
            profitLossClosed: tradeProfitLoss,
            closedAt: now,
            remainingPrincipal: remainingAmount,
            remainingProfitLoss: remainingReturn,
          });

          updatedTrades.push(trade);
        }

        await trade.save({ session });
      }

      // --------------------------------------------------
      // 6. CREATE THE SELL TRADE RECORD
      // --------------------------------------------------

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

          // Market value excluding bonus.
          positionAmount: baseValueToClose,

          // Entry cost and debt are tracked separately.
          positionCost: positionCostToClose,
          marginDebt: marginDebtToClose,
          leverage: Number(position.leverage) || 1,
        },

        targets: {
          takeProfit: null,
          stopLoss: null,
          entryPoint: position.averageEntryPrice,
          exitPoint: currentPrice,
        },

        performance: {
          currentBaseValue: baseValueToClose,
          currentValue: totalValueToClose,
          currentPrice,
          totalReturn: totalProfitLoss,
          totalReturnPercent,
          todayReturn: 0,
          todayReturnPercent: 0,
        },

        status: "closed",
        closedAt: now,
        closeReason: "admin_close",
        extra: extraToClose,
        fullname: position.fullname,
        positionId: position._id,
        closedTradesIds: closedTrades.map((trade) => trade._id),
      };

      const [sellTrade] = await Trade.create([sellTradeRecord], { session });

      // --------------------------------------------------
      // 7. APPLY THE CLOSE TO THE AGGREGATED POSITION
      // --------------------------------------------------

      const sellTradeForPosition = {
        _id: sellTrade._id,
        userId: position.userId,
        asset: position.asset,
        orderType: "sell",

        execution: {
          quantity: quantityToClose,
          amount: principalToClose,

          // updatePosition's sell branch should interpret this as
          // the closed market value, excluding bonus.
          positionAmount: baseValueToClose,
          positionCost: positionCostToClose,
          marginDebt: marginDebtToClose,
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

      // --------------------------------------------------
      // 8. COMMIT THE FINANCIAL TRANSACTION
      // --------------------------------------------------

      await session.commitTransaction();
      transactionCommitted = true;

      closeResult = {
        success: true,
        position: updatedPosition,
        sellTrade,
        close: {
          closeRatio,
          closePercentage: closeRatio * 100,
          baseValueClosed: baseValueToClose,
          extraClosed: extraToClose,
          grossValueClosed: totalValueToClose,
          principalClosed: principalToClose,
          positionCostClosed: positionCostToClose,
          marginDebtRepaid: marginDebtToClose,
          profitLoss: totalProfitLoss,
          cashReturned: settledCash,
        },
      };

      // --------------------------------------------------
      // 9. SNAPSHOTS AFTER COMMIT
      //
      // Snapshot failures must not roll back or fail the close.
      // Do not pass the already-committed session to these calls.
      // --------------------------------------------------

      try {
        await portfolioService.createPortfolioSnapshot(
          position.userId,
          "trade_sell",
          {
            tradeId: sellTrade._id,
            positionId: position._id,
            assetSymbol: position.asset.symbol,
            closeRatio,
            grossValueClosed: totalValueToClose,
            marginDebtRepaid: marginDebtToClose,
            cashReturned: settledCash,
          },
        );
      } catch (snapshotError) {
        console.error(
          "Portfolio snapshot failed after position close:",
          snapshotError,
        );
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
            grossValueClosed: totalValueToClose,
            marginDebtRepaid: marginDebtToClose,
            cashReturned: settledCash,
          },
        );
      } catch (snapshotError) {
        console.error(
          "Wallet snapshot failed after position close:",
          snapshotError,
        );
      }

      return closeResult;
    } catch (error) {
      if (!transactionCommitted && session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error(
            "Failed to abort close position transaction:",
            abortError,
          );
        }
      }

      if (error instanceof CustomError) {
        throw error;
      }

      console.error("closePosition error:", error);

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
