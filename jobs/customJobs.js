const Wallet = require("../models/Wallet");
const Trade = require("../models/Trade");
const User = require("../models/User");
const { logEvent } = require("../middlewares/loggers");
const axios = require("axios");
const Asset = require("../models/Asset");
const portFolioTracker = require("../services/user/chartService");

const BATCH_SIZE = process.env.CRON_BATCH_SIZE || 50;
const CRON_DELAY_MS = process.env.CRON_DELAY_MS || 300;
const COIN_GECKO_API_URL = "https://api.coingecko.com/api/v3";
const VS_CURRENCY = "usd";
const REQUEST_DELAY = 6500;

async function updateAssetsData() {
  console.log("Starting asset data update...");
  const startTime = Date.now();

  try {
    const assets = await Asset.find({
      type: "crypto",
      isActive: true,
    }).limit(250);

    if (assets.length === 0) {
      console.log("No active crypto assets found to update");
      return;
    }

    console.log(`Updating ${assets.length} crypto assets...`);

    const assetsByApiId = {};
    assets.forEach((asset) => {
      if (asset.apiId) {
        assetsByApiId[asset.apiId] = asset;
      }
    });

    const apiIds = Object.keys(assetsByApiId);

    if (apiIds.length === 0) {
      console.log("No assets with valid API IDs found");
      return;
    }

    console.log(`Found ${apiIds.length} assets with API IDs`);

    const BATCH_SIZE = 30;
    const batches = [];
    for (let i = 0; i < apiIds.length; i += BATCH_SIZE) {
      batches.push(apiIds.slice(i, i + BATCH_SIZE));
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `Processing batch ${i + 1}/${batches.length} (${
          batch.length
        } assets)...`
      );

      try {
        const batchResults = await processAssetBatch(batch, assetsByApiId);
        updatedCount += batchResults.updatedCount;
        errorCount += batchResults.errorCount;

        if (i < batches.length - 1) {
          console.log(
            `Waiting ${REQUEST_DELAY / 1000} seconds before next batch...`
          );
          await delay(REQUEST_DELAY);
        }
      } catch (batchError) {
        console.error(`Batch ${i + 1} failed:`, batchError.message);
        errorCount += batch.length;
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(
      `Asset update completed in ${duration}s: ${updatedCount} updated, ${errorCount} errors`
    );
  } catch (error) {
    console.error("Asset data update failed:", error.message);
    throw error;
  }
}

async function processAssetBatch(apiIds, assetsByApiId) {
  let updatedCount = 0;
  let errorCount = 0;

  try {
    const response = await axios.get(`${COIN_GECKO_API_URL}/coins/markets`, {
      params: {
        vs_currency: VS_CURRENCY,
        ids: apiIds.join(","), // Use CoinGecko IDs, not symbols
        order: "market_cap_desc",
        price_change_percentage: "24h,7d,30d,1y",
        sparkline: false,
      },
      timeout: 30000,
    });

    const marketData = response.data;

    // Create a map for quick lookup
    const marketDataMap = {};
    marketData.forEach((item) => {
      marketDataMap[item.id] = item;
    });

    // Process each asset in the batch
    for (const apiId of apiIds) {
      try {
        const asset = assetsByApiId[apiId];
        const cryptoData = marketDataMap[apiId];

        if (!cryptoData) {
          console.warn(
            `No market data found for ${apiId} (${asset?.symbol || "unknown"})`
          );
          errorCount++;
          continue;
        }

        const updateFields = {
          "priceData.current": cryptoData.current_price,
          "priceData.open": cryptoData.low_24h,
          "priceData.previousClose": cryptoData.ath || cryptoData.current_price,
          "priceData.dayLow": cryptoData.low_24h,
          "priceData.dayHigh": cryptoData.high_24h,
          "priceData.change": cryptoData.price_change_24h,
          "priceData.changePercent": cryptoData.price_change_percentage_24h,
          "priceData.volume": cryptoData.total_volume,
          "priceData.avgVolume": cryptoData.total_volume,
          "fundamentals.marketCap": cryptoData.market_cap,
          lastUpdated: new Date(),
        };

        // Only update historical data if we have meaningful values
        if (cryptoData.atl) {
          updateFields["historical.yearLow"] = cryptoData.atl;
        }
        if (cryptoData.ath) {
          updateFields["historical.yearHigh"] = cryptoData.ath;
        }

        // Clean null/undefined values
        Object.keys(updateFields).forEach((key) => {
          if (updateFields[key] === null || updateFields[key] === undefined) {
            delete updateFields[key];
          }
        });

        const result = await Asset.updateOne(
          { _id: asset._id }, // Use _id for more reliable updates
          { $set: updateFields }
        );

        if (result.modifiedCount > 0) {
          updatedCount++;
          console.log(
            `Updated ${asset.symbol} - $${
              cryptoData.current_price?.toFixed(2) || "N/A"
            }`
          );
        } else {
          console.log(`No changes for ${asset.symbol}`);
        }
      } catch (assetError) {
        console.error(`Error updating ${apiId}:`, assetError.message);
        errorCount++;
      }
    }

    // Log missing assets that were in the batch but not returned
    const returnedApiIds = marketData.map((item) => item.id);
    const missingApiIds = apiIds.filter(
      (apiId) => !returnedApiIds.includes(apiId)
    );

    for (const missingApiId of missingApiIds) {
      const asset = assetsByApiId[missingApiId];
      console.warn(
        `No market data returned for ${missingApiId} (${
          asset?.symbol || "unknown"
        })`
      );
      errorCount++;
    }
  } catch (error) {
    console.error("Batch API call failed:", error.message);

    if (error.response?.status === 429) {
      console.log("Rate limited, waiting 30 seconds before retry...");
      await delay(30000);
      // Optionally retry this batch
      return processAssetBatch(apiIds, assetsByApiId);
    }

    errorCount += apiIds.length;
    throw error;
  }

  return { updatedCount, errorCount };
}

async function fetchAssetsWithRetry(assetSymbols, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching assets (attempt ${attempt}/${maxRetries})...`);
      const assets = await Asset.find();

      const fetchedSymbols = assets
        .map((a) => a.symbol?.toUpperCase())
        .filter(Boolean);
      const missingSymbols = assetSymbols.filter(
        (symbol) => !fetchedSymbols.includes(symbol)
      );

      if (missingSymbols.length > 0) {
        console.log(`Missing data for symbols: ${missingSymbols.join(", ")}`);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          continue;
        }
      }

      return assets;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

async function updateWalletPerformance() {
  console.log("Starting optimized Wallet performance update...");
  const startTime = Date.now();

  try {
    const walletUpdates = await Trade.aggregate([
      {
        $match: {
          status: "open",
          "wallet.id": { $ne: null },
        },
      },
      {
        $lookup: {
          from: "wallets",
          localField: "wallet.id",
          foreignField: "_id",
          as: "walletInfo",
        },
      },
      {
        $unwind: {
          path: "$walletInfo",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: "$wallet.id",
          userId: { $first: "$userId" },
          totalTodayReturn: { $sum: "$performance.todayReturn" },
          totalInvestment: { $sum: "$execution.amount" },
          tradeCount: { $sum: 1 },
        },
      },
      {
        $project: {
          walletId: "$_id",
          userId: 1,
          totalTodayReturn: 1,
          totalInvestment: 1,
          tradeCount: 1,
          dailyProfitPercent: {
            $cond: {
              if: { $gt: ["$totalInvestment", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalTodayReturn", "$totalInvestment"] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ]);

    console.log(`Processing ${walletUpdates.length} wallets with trades`);

    if (walletUpdates.length === 0) {
      // No wallets with trades, reset all
      await Wallet.updateMany(
        {},
        {
          $set: {
            dailyProfit: 0,
            dailyProfitPercent: 0,
          },
        }
      );
    } else {
      // Prepare bulk operations
      const bulkOps = walletUpdates.map((item) => ({
        updateOne: {
          filter: {
            _id: item.walletId,
            userId: item.userId,
          },
          update: {
            $set: {
              dailyProfit: item.totalTodayReturn,
              dailyProfitPercent: item.dailyProfitPercent,
            },
          },
        },
      }));

      // Execute bulk write
      const bulkResult = await Wallet.bulkWrite(bulkOps, { ordered: false });

      // Reset wallets without trades
      const walletIdsUpdated = walletUpdates.map((item) => item.walletId);
      const resetResult = await Wallet.updateMany(
        {
          _id: { $nin: walletIdsUpdated },
        },
        {
          $set: {
            dailyProfit: 0,
            dailyProfitPercent: 0,
          },
        }
      );

      console.log(
        `Updated ${bulkResult.modifiedCount} wallets, reset ${resetResult.modifiedCount} wallets`
      );
    }

    const duration = Date.now() - startTime;
    const msg = `Optimized update completed in ${duration}ms.`;
    logEvent(msg, "cron.txt");
  } catch (error) {
    console.error("Error in optimized updateWalletPerformance:", error);
    throw error;
  }
}

const updateTradePerformance = async () => {
  try {
    console.log("Starting trade performance update...");
    const startTime = Date.now();

    const openTrades = await Trade.find(
      { status: "open", "asset.symbol": { $exists: true, $ne: null } },
      {
        "asset.symbol": 1,
        "execution.price": 1,
        "execution.quantity": 1,
        "execution.amount": 1,
        "execution.leverage": 1,
        "performance.totalReturn": 1,
        "performance.todayReturn": 1,
        "performance.currentValue": 1,
        "targets.takeProfit": 1,
        "targets.stopLoss": 1,
        orderType: 1,
        extra: 1,
        "wallet.id": 1,
        createdAt: 1,
        userId: 1,
      }
    ).lean();

    if (openTrades.length === 0) {
      console.log("No open trades found.");
      return;
    }

    console.log(`Found ${openTrades.length} open trades to update.`);

    const assetSymbols = [];
    const symbolSet = new Set();

    for (const trade of openTrades) {
      if (trade.asset?.symbol) {
        const symbol = trade.asset.symbol.toUpperCase();
        if (!symbolSet.has(symbol)) {
          symbolSet.add(symbol);
          assetSymbols.push(symbol);
        }
      }
    }

    if (assetSymbols.length === 0) {
      console.log("No assets found in open trades.");
      return;
    }

    console.log(`Fetching current prices for ${assetSymbols.length} assets...`);

    let currentAssets;
    try {
      currentAssets = await fetchAssetsWithRetry(assetSymbols);
    } catch (error) {
      console.error("Error fetching assets after retries:", error.message);
      return;
    }

    const assetPriceMap = new Map();
    for (const asset of currentAssets) {
      if (asset?.symbol && asset?.priceData?.current) {
        assetPriceMap.set(asset.symbol.toUpperCase(), asset.priceData.current);
      }
    }

    const tradeUpdates = [];
    const tradesToClose = []; // Trades that hit TP/SL
    const now = new Date();

    for (const trade of openTrades) {
      const symbol = trade.asset?.symbol?.toUpperCase();
      if (!symbol) continue;

      const currentPrice = assetPriceMap.get(symbol);
      if (!currentPrice) continue;

      const entryPrice = trade.execution?.price || 0;
      const quantity = trade.execution?.quantity || 0;
      const investedAmount = trade.execution?.amount || 0;
      const leverage = trade.execution?.leverage || 1;
      const extraBonus = trade.extra || 0;

      if (quantity === 0 || entryPrice === 0) continue;

      // Calculate current value based on order type
      let currentValue;
      if (trade.orderType === "buy") {
        currentValue = quantity * currentPrice * leverage;
      } else if (trade.orderType === "sell") {
        currentValue = investedAmount - quantity * currentPrice * leverage;
      } else {
        currentValue = quantity * currentPrice;
      }

      const totalCurrentValue = currentValue + extraBonus;
      const totalReturn = totalCurrentValue - investedAmount;
      const totalReturnPercent =
        investedAmount > 0 ? (totalReturn / investedAmount) * 100 : 0;

      const previousCurrentValue =
        trade.performance?.currentValue || totalCurrentValue;
      const todayReturn = totalCurrentValue - previousCurrentValue;
      const todayReturnPercent =
        previousCurrentValue > 0
          ? (todayReturn / previousCurrentValue) * 100
          : 0;

      // Check if trade should be closed by TP/SL
      const shouldCloseByTP =
        trade.targets?.takeProfit &&
        totalReturnPercent >= trade.targets.takeProfit;
      const shouldCloseBySL =
        trade.targets?.stopLoss && totalReturnPercent <= trade.targets.stopLoss;

      if (shouldCloseByTP || shouldCloseBySL) {
        tradesToClose.push({
          trade,
          currentValue: totalCurrentValue,
          totalReturn,
          totalReturnPercent,
          closeReason: shouldCloseByTP ? "take_profit" : "stop_loss",
        });
      }

      tradeUpdates.push({
        updateOne: {
          filter: { _id: trade._id },
          update: {
            $set: {
              "performance.totalReturn": parseFloat(totalReturn.toFixed(4)),
              "performance.totalReturnPercent": parseFloat(
                totalReturnPercent.toFixed(4)
              ),
              "performance.todayReturn": parseFloat(todayReturn.toFixed(4)),
              "performance.todayReturnPercent": parseFloat(
                todayReturnPercent.toFixed(4)
              ),
              "performance.currentValue": parseFloat(
                totalCurrentValue.toFixed(4)
              ),
              updatedAt: now,
            },
          },
        },
      });
    }

    // Process trade updates in batches
    if (tradeUpdates.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < tradeUpdates.length; i += BATCH_SIZE) {
        const batch = tradeUpdates.slice(i, i + BATCH_SIZE);
        try {
          await Trade.bulkWrite(batch, { ordered: false });
          console.log(
            `Updated ${batch.length} trades in batch ${
              Math.floor(i / BATCH_SIZE) + 1
            }`
          );
        } catch (batchError) {
          console.error(
            `Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
            batchError.message
          );
        }
      }
    }

    // Process trades that need to be closed
    if (tradesToClose.length > 0) {
      console.log(`Closing ${tradesToClose.length} trades (TP/SL reached)`);
      await closeTradesInBatch(tradesToClose, now);
    }

    const duration = Date.now() - startTime;
    console.log(`Trade performance update completed in ${duration}ms.`);
  } catch (error) {
    console.error("Error in updateTradePerformance:", error);
    throw error;
  }
};

async function closeTradesInBatch(tradesToClose, closeTime) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const closePromises = tradesToClose.map(
      async ({ trade, currentValue, totalReturn, closeReason }) => {
        try {
          await Trade.updateOne(
            { _id: trade._id },
            {
              $set: {
                status: "closed",
                closedAt: closeTime,
                closeReason: closeReason,
                "targets.exitPoint":
                  trade.performance?.currentValue || currentValue,
              },
            },
            { session }
          );

          if (trade.wallet?.id) {
            await Wallet.updateOne(
              { _id: trade.wallet.id },
              {
                $inc: {
                  availableBalance: currentValue,
                  totalBalance: totalReturn,
                },
              },
              { session }
            );
          }

          await recordTradeInPortfolio(
            trade.userId,
            totalReturn,
            `Trade closed (${closeReason}): ${trade.asset.symbol} ${
              trade.orderType
            } - ${totalReturn >= 0 ? "Profit" : "Loss"} of $${Math.abs(
              totalReturn
            ).toFixed(2)}`
          );

          return { tradeId: trade._id, success: true };
        } catch (error) {
          console.error(`Error closing trade ${trade._id}:`, error.message);
          return { tradeId: trade._id, success: false, error: error.message };
        }
      }
    );

    const results = await Promise.all(closePromises);
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Closed ${successful} trades successfully, ${failed} failed`);

    await session.commitTransaction();

    const failedTrades = results.filter((r) => !r.success);
    if (failedTrades.length > 0) {
      console.log(
        "Failed trades:",
        failedTrades.map((ft) => ft.tradeId)
      );

      await queueFailedTradeClosures(failedTrades);
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in batch trade closure:", error);
    throw error;
  } finally {
    session.endSession();
  }
}

async function recordTradeInPortfolio(userId, pnl, description) {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await portFolioTracker.recordTrade(userId, pnl, description);
      console.log(`Portfolio recorded for user ${userId}: $${pnl.toFixed(2)}`);
      return true;
    } catch (error) {
      console.error(
        `Attempt ${attempt} failed to record portfolio for user ${userId}:`,
        error.message
      );

      if (attempt === MAX_RETRIES) {
        // Log to monitoring and queue for later
        await queuePortfolioRetry({
          userId,
          pnl,
          description,
          timestamp: new Date(),
          retryCount: 0,
        });
        return false;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  updateTradePerformance,
  updateWalletPerformance,
  updateAssetsData,
};
