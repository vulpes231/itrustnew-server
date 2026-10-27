const Wallet = require("../models/Wallet");
const Trade = require("../models/Trade");
const User = require("../models/User");
const { logEvent } = require("../middlewares/loggers");
const axios = require("axios");
const Asset = require("../models/Asset");
const portFolioTracker = require("../services/user/portfolioService");
const Position = require("../models/Position");
const walletSnapshotService = require("../services/user/walletSnapshotService");
const portfolioService = require("../services/user/portfolioService");
const BATCH_SIZE = process.env.CRON_BATCH_SIZE || 50;
const CRON_DELAY_MS = process.env.CRON_DELAY_MS || 300;
const COIN_GECKO_API_URL = "https://api.coingecko.com/api/v3";
const VS_CURRENCY = "usd";
const REQUEST_DELAY = 6500;

async function updateAssetsData() {
  console.log("Starting asset data update...");
  const startTime = Date.now();

  try {
    console.log("Updating CRYPTO assets...");
    await updateCryptoAssets();

    console.log("Updating STOCK assets...");
    await updateStockAssets();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`Asset update completed in ${duration}s`);
  } catch (error) {
    console.error("Asset data update failed:", error.message);
    throw error;
  }
}

async function updateCryptoAssets() {
  console.log("Starting crypto asset update...");
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
        `Processing crypto batch ${i + 1}/${batches.length} (${
          batch.length
        } assets)...`,
      );

      try {
        const batchResults = await processCryptoBatch(batch, assetsByApiId);
        updatedCount += batchResults.updatedCount;
        errorCount += batchResults.errorCount;

        if (i < batches.length - 1) {
          console.log(
            `Waiting ${REQUEST_DELAY / 1000} seconds before next batch...`,
          );
          await delay(REQUEST_DELAY);
        }
      } catch (batchError) {
        console.error(`Crypto batch ${i + 1} failed:`, batchError.message);
        errorCount += batch.length;
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(
      `Crypto update completed in ${duration}s: ${updatedCount} updated, ${errorCount} errors`,
    );
  } catch (error) {
    console.error("Crypto asset data update failed:", error.message);
    throw error;
  }
}

async function updateStockAssets() {
  console.log("Starting stock asset update...");
  const startTime = Date.now();

  try {
    const assets = await Asset.find({
      type: "stock",
      isActive: true,
    }).limit(250);

    if (assets.length === 0) {
      console.log("No active stock assets found to update");
      return;
    }

    console.log(`Updating ${assets.length} stock assets...`);

    const stocksBySymbol = {};
    assets.forEach((asset) => {
      if (asset.symbol) {
        stocksBySymbol[asset.symbol] = asset;
      }
    });

    const symbols = Object.keys(stocksBySymbol);

    if (symbols.length === 0) {
      console.log("No stocks with valid symbols found");
      return;
    }

    console.log(`Found ${symbols.length} stocks to update`);

    const STOCK_BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < symbols.length; i += STOCK_BATCH_SIZE) {
      batches.push(symbols.slice(i, i + STOCK_BATCH_SIZE));
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `Processing stock batch ${i + 1}/${batches.length} (${
          batch.length
        } stocks)...`,
      );

      try {
        const batchResults = await processStockBatch(batch, stocksBySymbol);
        updatedCount += batchResults.updatedCount;
        errorCount += batchResults.errorCount;

        if (i < batches.length - 1) {
          await delay(2000);
        }
      } catch (batchError) {
        console.error(`Stock batch ${i + 1} failed:`, batchError.message);
        errorCount += batch.length;
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(
      `Stock update completed in ${duration}s: ${updatedCount} updated, ${errorCount} errors`,
    );
  } catch (error) {
    console.error("Stock asset data update failed:", error.message);
    throw error;
  }
}

async function processStockBatch(symbols, stocksBySymbol) {
  let updatedCount = 0;
  let errorCount = 0;

  const FMP_API_KEY = process.env.FMP_API_KEY;
  const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";

  try {
    const symbolsParam = symbols.join(",");
    const quoteUrl = `${FMP_BASE_URL}/quote/${symbolsParam}`;

    const response = await axios.get(quoteUrl, {
      params: {
        apikey: FMP_API_KEY,
      },
      timeout: 15000,
    });

    if (response.data && Array.isArray(response.data)) {
      for (const quote of response.data) {
        const asset = stocksBySymbol[quote.symbol];

        if (asset && quote) {
          try {
            const updateData = {
              "priceData.current": quote.price || asset.priceData.current,
              "priceData.open": quote.open,
              "priceData.previousClose": quote.previousClose,
              "priceData.dayLow": quote.dayLow,
              "priceData.dayHigh": quote.dayHigh,
              "priceData.change": quote.change,
              "priceData.changePercent": quote.changesPercentage,
              "priceData.volume": quote.volume,
              "priceData.avgVolume": quote.avgVolume,
              "historical.yearLow": quote.yearLow,
              "historical.yearHigh": quote.yearHigh,
              "fundamentals.marketCap":
                quote.marketCap || asset.fundamentals.marketCap,
              "fundamentals.pe": quote.pe || asset.fundamentals.pe,
              lastUpdated: new Date(),
            };

            await Asset.findByIdAndUpdate(asset._id, updateData);
            updatedCount++;
            console.log(`✅ Updated stock: ${quote.symbol} - $${quote.price}`);
          } catch (err) {
            console.error(`Error updating stock ${quote.symbol}:`, err.message);
            errorCount++;
          }
        }
      }
    }

    for (const symbol of symbols) {
      const asset = stocksBySymbol[symbol];
      if (asset && !response.data.find((q) => q.symbol === symbol)) {
        console.log(`⚠️ No data found for stock: ${symbol}`);
        errorCount++;
      }
    }
  } catch (error) {
    console.error("Error fetching stock data:", error.message);
    errorCount += symbols.length;
  }

  return { updatedCount, errorCount };
}

async function processCryptoBatch(apiIds, assetsByApiId) {
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
            `No market data found for ${apiId} (${asset?.symbol || "unknown"})`,
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
          { $set: updateFields },
        );

        if (result.modifiedCount > 0) {
          updatedCount++;
          console.log(
            `Updated ${asset.symbol} - $${
              cryptoData.current_price?.toFixed(2) || "N/A"
            }`,
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
      (apiId) => !returnedApiIds.includes(apiId),
    );

    for (const missingApiId of missingApiIds) {
      const asset = assetsByApiId[missingApiId];
      console.warn(
        `No market data returned for ${missingApiId} (${
          asset?.symbol || "unknown"
        })`,
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

const isMarketOpen = () => {
  const now = new Date();
  const estTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const hour = estTime.getHours();
  const day = estTime.getDay();

  // Weekday and between 9:30 AM - 4:00 PM EST
  return day >= 1 && day <= 5 && hour >= 9.5 && hour < 16;
};

async function fetchAssetsWithRetry(assetSymbols, maxRetries = 3) {
  if (!assetSymbols || assetSymbols.length === 0) {
    console.log("No asset symbols provided");
    return [];
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `Fetching assets for ${assetSymbols.length} symbols (attempt ${attempt}/${maxRetries})...`,
      );

      const assets = await Asset.find({
        symbol: { $in: assetSymbols.map((s) => s.toUpperCase()) },
        isActive: true,
      }).lean();

      const fetchedSymbols = assets
        .map((a) => a.symbol?.toUpperCase())
        .filter(Boolean);

      const missingSymbols = assetSymbols.filter(
        (symbol) => !fetchedSymbols.includes(symbol.toUpperCase()),
      );

      if (missingSymbols.length > 0) {
        console.log(
          `⚠️ Missing data for symbols: ${missingSymbols.join(", ")}`,
        );

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
          console.log(`Retrying in ${delay / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        } else {
          console.warn(
            `Could not fetch ${missingSymbols.length} symbols after ${maxRetries} attempts`,
          );
        }
      }

      console.log(`Successfully fetched ${assets.length} assets`);
      return assets;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`Failed to fetch assets after ${maxRetries} attempts`);
        throw error;
      }
    }
  }

  return [];
}

async function updateWalletPerformance() {
  console.log("Starting wallet performance update...");
  const startTime = Date.now();

  try {
    const walletUpdates = await Position.aggregate([
      {
        $match: {
          status: "open",
          "wallet.id": { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$wallet.id",
          userId: { $first: "$userId" },

          totalTodayReturn: {
            $sum: {
              $ifNull: ["$performance.todayReturn", 0],
            },
          },

          totalInvested: {
            $sum: {
              $ifNull: ["$amountInvested", 0],
            },
          },

          positionCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          walletId: "$_id",
          userId: 1,
          totalTodayReturn: 1,
          totalInvested: 1,
          positionCount: 1,

          dailyProfitPercent: {
            $cond: [
              { $gt: ["$totalInvested", 0] },
              {
                $multiply: [
                  {
                    $divide: ["$totalTodayReturn", "$totalInvested"],
                  },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
    ]);

    console.log(
      `Processing ${walletUpdates.length} wallets with open positions.`,
    );

    const walletIds = walletUpdates.map((item) => item.walletId);

    if (walletUpdates.length > 0) {
      const bulkOps = walletUpdates.map((item) => ({
        updateOne: {
          filter: {
            _id: item.walletId,
            ...(item.userId ? { userId: item.userId } : {}),
          },
          update: {
            $set: {
              dailyProfit: Number((item.totalTodayReturn || 0).toFixed(4)),
              dailyProfitPercent: Number(
                (item.dailyProfitPercent || 0).toFixed(4),
              ),
            },
          },
        },
      }));

      const bulkResult = await Wallet.bulkWrite(bulkOps, {
        ordered: false,
      });

      const resetResult = await Wallet.updateMany(
        {
          _id: { $nin: walletIds },
        },
        {
          $set: {
            dailyProfit: 0,
            dailyProfitPercent: 0,
          },
        },
      );

      console.log(
        `Updated ${bulkResult.modifiedCount} wallets; ` +
          `reset ${resetResult.modifiedCount} wallets.`,
      );
    } else {
      const resetResult = await Wallet.updateMany(
        {},
        {
          $set: {
            dailyProfit: 0,
            dailyProfitPercent: 0,
          },
        },
      );

      console.log(
        `No open positions found. Reset ${resetResult.modifiedCount} wallets.`,
      );
    }

    const duration = Date.now() - startTime;
    const msg = `Wallet performance update completed in ${duration}ms.`;
    logEvent(msg, "cron.txt");
  } catch (error) {
    console.error("Error in updateWalletPerformance:", error);
    throw error;
  }
}

const calculateTradeValue = (trade, currentPrice) => {
  const entryPrice = Number(trade.execution?.price) || 0;
  const quantity = Number(trade.execution?.quantity) || 0;
  const investedCapital = Number(trade.execution?.amount) || 0;

  const positionAmount =
    Number(trade.execution?.positionAmount) || investedCapital;

  const positionCost = Number(trade.execution?.positionCost) || positionAmount;

  const extra = Number(trade.extra) || 0;
  const isBuy = trade.orderType === "buy";

  const currentBaseValue =
    Number(trade.performance?.currentBaseValue) || positionCost;

  let marketChange = 0;

  if (
    Number.isFinite(currentPrice) &&
    currentPrice > 0 &&
    quantity > 0 &&
    entryPrice > 0
  ) {
    if (isBuy) {
      const currentMarketValue = quantity * currentPrice;
      marketChange = currentMarketValue - positionCost;
    } else {
      marketChange = (entryPrice - currentPrice) * quantity;
    }
  }

  // Market P/L plus the already leverage-adjusted bonus.
  const totalReturn = marketChange + extra;

  // Base + market movement + bonus.
  const currentValue = currentBaseValue + totalReturn;

  const totalReturnPercent =
    investedCapital > 0 ? (totalReturn / investedCapital) * 100 : 0;

  return {
    currentBaseValue,
    currentValue,
    totalReturn,
    totalReturnPercent,
  };
};

const updateTradePerformance = async () => {
  try {
    console.log("Starting trade performance update...");

    const startTime = Date.now();
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const openTrades = await Trade.find(
      {
        status: "open",
        "asset.symbol": { $exists: true, $ne: null },
      },
      {
        assetType: 1,
        "asset.symbol": 1,
        "execution.price": 1,
        "execution.quantity": 1,
        "execution.amount": 1,
        "execution.positionAmount": 1,
        "execution.positionCost": 1,
        "execution.marginDebt": 1,
        "execution.leverage": 1,
        "performance.currentBaseValue": 1,
        "performance.currentValue": 1,
        "performance.totalReturn": 1,
        "performance.totalReturnPercent": 1,
        "performance.todayReturn": 1,
        "performance.todayReturnPercent": 1,
        "performance.todayMarketReturn": 1,
        "performance.todayExtra": 1,
        "performance.todayStartValue": 1,
        "performance.todayStartDate": 1,
        "performance.currentPrice": 1,
        "performance.previousClose": 1,
        "targets.takeProfit": 1,
        "targets.stopLoss": 1,
        orderType: 1,
        extra: 1,
        "wallet.id": 1,
        createdAt: 1,
        userId: 1,
      },
    ).lean();

    if (!openTrades.length) {
      console.log("No open trades found.");
      return;
    }

    console.log(`Found ${openTrades.length} open trades.`);

    const symbols = [
      ...new Set(
        openTrades
          .map((trade) => trade.asset?.symbol?.toUpperCase())
          .filter(Boolean),
      ),
    ];

    let currentAssets;

    try {
      currentAssets = await fetchAssetsWithRetry(symbols);
    } catch (error) {
      console.error("Failed to fetch asset prices:", error.message);
      return;
    }

    const priceMap = new Map();

    for (const asset of currentAssets || []) {
      if (!asset?.symbol) continue;

      priceMap.set(asset.symbol.toUpperCase(), {
        current: Number(asset.priceData?.current),
        previousClose: Number(asset.priceData?.previousClose),
      });
    }

    const tradeUpdates = [];
    const tradesToClose = [];

    const skipped = {
      missingSymbol: 0,
      missingAssetData: 0,
      invalidPrice: 0,
      invalidQuantity: 0,
      invalidEntryCost: 0,
    };

    const skippedSymbols = new Set();

    const isSameDay = (dateA, dateB) =>
      dateA instanceof Date &&
      !Number.isNaN(dateA.getTime()) &&
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate();

    const round4 = (value) => Number(value.toFixed(4));

    for (const trade of openTrades) {
      const symbol = trade.asset?.symbol?.toUpperCase();

      if (!symbol) {
        skipped.missingSymbol++;
        continue;
      }

      const assetData = priceMap.get(symbol);

      if (!assetData) {
        skipped.missingAssetData++;
        skippedSymbols.add(symbol);
        continue;
      }

      const currentPrice = assetData.current;
      const previousClose = assetData.previousClose;

      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        skipped.invalidPrice++;
        skippedSymbols.add(symbol);
        continue;
      }

      const quantity = Number(trade.execution?.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        skipped.invalidQuantity++;
        continue;
      }

      // Prefer the recorded leveraged entry cost.
      // positionAmount is the gross exposure at entry, not current value.
      const rawEntryCost =
        trade.execution?.positionCost ??
        trade.execution?.positionAmount ??
        trade.execution?.amount;

      const entryCost = Number(rawEntryCost);

      if (!Number.isFinite(entryCost) || entryCost < 0) {
        skipped.invalidEntryCost++;
        continue;
      }

      // Current market value, excluding bonus.
      const currentBaseValue = quantity * currentPrice;

      // Bonus allocated to this trade.
      const extra = Number(trade.extra ?? 0);

      if (!Number.isFinite(extra) || extra < 0) {
        console.error(`Invalid bonus on trade ${trade._id}`);
        continue;
      }

      const currentValue = currentBaseValue + extra;

      // Market P/L + bonus. Debt is excluded from profit/loss.
      const totalReturn = currentBaseValue - entryCost + extra;

      // User-funded principal is the return percentage denominator.
      const investedCapital = Number(trade.execution?.amount ?? 0);

      const totalReturnPercent =
        investedCapital > 0 ? (totalReturn / investedCapital) * 100 : 0;

      const openedAt = trade.createdAt ? new Date(trade.createdAt) : null;

      const openedToday = openedAt && isSameDay(openedAt, now);

      const storedStartDate = trade.performance?.todayStartDate
        ? new Date(trade.performance.todayStartDate)
        : null;

      const startDateIsToday =
        storedStartDate && isSameDay(storedStartDate, now);

      let todayStartValue = Number(trade.performance?.todayStartValue);

      if (!Number.isFinite(todayStartValue) || !startDateIsToday) {
        // For a trade opened today, use its entry market cost as
        // the baseline. For an older trade, establish today's
        // baseline at its current market value.
        todayStartValue = openedToday ? entryCost : currentBaseValue;
      }

      const todayMarketReturn = currentBaseValue - todayStartValue;

      // Maintained by your existing bonus/update logic.
      const todayExtra = Number(trade.performance?.todayExtra ?? 0);

      const todayReturn = todayMarketReturn + todayExtra;

      const todayReturnPercent =
        investedCapital > 0 ? (todayReturn / investedCapital) * 100 : 0;

      const takeProfit = Number(trade.targets?.takeProfit ?? 0);
      const stopLoss = Number(trade.targets?.stopLoss ?? 0);

      const shouldCloseByTP =
        takeProfit > 0 && totalReturnPercent >= takeProfit;

      const shouldCloseBySL = stopLoss !== 0 && totalReturnPercent <= stopLoss;

      if (shouldCloseByTP || shouldCloseBySL) {
        tradesToClose.push({
          trade,
          currentValue,
          currentBaseValue,
          totalReturn,
          totalReturnPercent,
          closeReason: shouldCloseByTP ? "take_profit" : "stop_loss",
        });
      }

      tradeUpdates.push({
        updateOne: {
          filter: {
            _id: trade._id,
            status: "open",
          },
          update: {
            $set: {
              "performance.currentBaseValue": round4(currentBaseValue),
              "performance.currentValue": round4(currentValue),
              "performance.totalReturn": round4(totalReturn),
              "performance.totalReturnPercent": round4(totalReturnPercent),

              "performance.todayStartValue": round4(todayStartValue),
              "performance.todayStartDate": todayStart,
              "performance.todayMarketReturn": round4(todayMarketReturn),
              "performance.todayExtra": round4(todayExtra),
              "performance.todayReturn": round4(todayReturn),
              "performance.todayReturnPercent": round4(todayReturnPercent),

              "performance.currentPrice": round4(currentPrice),

              ...(Number.isFinite(previousClose) && previousClose > 0
                ? {
                    "performance.previousClose": round4(previousClose),
                  }
                : {}),

              updatedAt: now,
            },
          },
        },
      });
    }

    const BATCH_SIZE = 500;

    for (let i = 0; i < tradeUpdates.length; i += BATCH_SIZE) {
      const batch = tradeUpdates.slice(i, i + BATCH_SIZE);

      try {
        const result = await Trade.bulkWrite(batch, {
          ordered: false,
        });

        console.log("Trade performance batch:", {
          attempted: batch.length,
          matched: result.matchedCount,
          modified: result.modifiedCount,
        });
      } catch (error) {
        console.error("Trade performance batch failed:", error);
      }
    }

    if (tradesToClose.length) {
      console.log(`Closing ${tradesToClose.length} trades due to TP/SL.`);

      await closeTradesInBatch(tradesToClose, now);
    }

    console.log(
      `Trade performance update completed in ${Date.now() - startTime}ms.`,
    );

    console.log("Skipped trade records:", {
      ...skipped,
      skippedSymbols: [...skippedSymbols],
    });
  } catch (error) {
    console.error("Error in updateTradePerformance:", error);
    throw error;
  }
};

const updatePositionsPerformance = async () => {
  try {
    const startTime = Date.now();
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const round4 = (value) => Number(value.toFixed(4));

    const isSameDay = (dateA, dateB) =>
      dateA instanceof Date &&
      !Number.isNaN(dateA.getTime()) &&
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate();

    const openPositions = await Position.find(
      {
        status: "open",
        "asset.symbol": { $exists: true, $ne: null },
      },
      {
        userId: 1,
        wallet: 1,
        asset: 1,
        quantity: 1,
        amountInvested: 1,
        positionCost: 1,
        marginDebt: 1,
        performance: 1,
        createdAt: 1,
      },
    ).lean();

    if (!openPositions.length) {
      console.log("No open positions found.");
      return;
    }

    const symbols = [
      ...new Set(
        openPositions
          .map((position) => position.asset?.symbol?.toUpperCase())
          .filter(Boolean),
      ),
    ];

    let currentAssets;

    try {
      currentAssets = await fetchAssetsWithRetry(symbols);
    } catch (error) {
      console.error("Failed to fetch position prices:", error.message);
      return;
    }

    const priceMap = new Map();

    for (const asset of currentAssets || []) {
      if (!asset?.symbol) continue;

      priceMap.set(asset.symbol.toUpperCase(), {
        current: Number(asset.priceData?.current),
        previousClose: Number(asset.priceData?.previousClose),
      });
    }

    const positionUpdates = [];
    const affectedWalletIds = new Set();
    const affectedUserIds = new Set();

    const skipped = {
      missingAssetData: 0,
      invalidPrice: 0,
      invalidQuantity: 0,
      invalidPrincipal: 0,
      invalidEntryCost: 0,
    };

    for (const position of openPositions) {
      const symbol = position.asset?.symbol?.toUpperCase();

      if (!symbol) {
        skipped.missingAssetData++;
        continue;
      }

      const assetData = priceMap.get(symbol);

      if (!assetData) {
        skipped.missingAssetData++;
        continue;
      }

      const currentPrice = assetData.current;
      const previousClose = assetData.previousClose;

      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        skipped.invalidPrice++;
        continue;
      }

      const quantity = Number(position.quantity);
      const amountInvested = Number(position.amountInvested);
      const positionCost = Number(position.positionCost);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        skipped.invalidQuantity++;
        continue;
      }

      if (!Number.isFinite(amountInvested) || amountInvested < 0) {
        skipped.invalidPrincipal++;
        continue;
      }

      // Do not silently treat missing entry cost as zero.
      // Zero cost with a non-zero position can produce false profits.
      if (!Number.isFinite(positionCost) || positionCost < 0) {
        skipped.invalidEntryCost++;
        console.warn(`Skipping position ${position._id}: invalid positionCost`);
        continue;
      }

      // Current market value, excluding bonus.
      const currentBaseValue = quantity * currentPrice;

      // Preserve the existing position bonus.
      const extra = Number(position.performance?.extra ?? 0);

      if (!Number.isFinite(extra) || extra < 0) {
        console.warn(`Skipping position ${position._id}: invalid bonus`);
        continue;
      }

      const currentValue = currentBaseValue + extra;

      // Market P/L + bonus. Margin debt is excluded.
      const totalReturn = currentBaseValue - positionCost + extra;

      const totalReturnPercent =
        amountInvested > 0 ? (totalReturn / amountInvested) * 100 : 0;

      const openedAt = position.createdAt ? new Date(position.createdAt) : null;

      const openedToday = openedAt && isSameDay(openedAt, now);

      const storedStartDate = position.performance?.todayStartDate
        ? new Date(position.performance.todayStartDate)
        : null;

      const startDateIsToday =
        storedStartDate && isSameDay(storedStartDate, now);

      let todayStartValue = Number(position.performance?.todayStartValue);

      if (!Number.isFinite(todayStartValue) || !startDateIsToday) {
        // The position's entry cost is the opening-day baseline.
        // Existing positions establish a fresh baseline at today's
        // current market value.
        todayStartValue = openedToday ? positionCost : currentBaseValue;
      }

      const todayMarketReturn = currentBaseValue - todayStartValue;

      const todayExtra = Number(position.performance?.todayExtra ?? 0);

      const todayReturn = todayMarketReturn + todayExtra;

      const todayReturnPercent =
        amountInvested > 0 ? (todayReturn / amountInvested) * 100 : 0;

      positionUpdates.push({
        updateOne: {
          filter: {
            _id: position._id,
            status: "open",
          },
          update: {
            $set: {
              "performance.currentBaseValue": round4(currentBaseValue),
              "performance.currentValue": round4(currentValue),
              "performance.extra": round4(extra),

              "performance.totalReturn": round4(totalReturn),
              "performance.totalReturnPercent": round4(totalReturnPercent),

              "performance.todayStartValue": round4(todayStartValue),
              "performance.todayStartDate": todayStart,
              "performance.todayMarketReturn": round4(todayMarketReturn),
              "performance.todayExtra": round4(todayExtra),
              "performance.todayReturn": round4(todayReturn),
              "performance.todayReturnPercent": round4(todayReturnPercent),

              "performance.currentPrice": round4(currentPrice),

              ...(Number.isFinite(previousClose) && previousClose > 0
                ? {
                    "performance.previousClose": round4(previousClose),
                  }
                : {}),

              updatedAt: now,
            },
          },
        },
      });

      if (position.userId) {
        affectedUserIds.add(position.userId.toString());
      }

      if (position.wallet?.id) {
        affectedWalletIds.add(position.wallet.id.toString());
      }
    }

    const BATCH_SIZE = 500;

    for (let i = 0; i < positionUpdates.length; i += BATCH_SIZE) {
      const batch = positionUpdates.slice(i, i + BATCH_SIZE);

      try {
        const result = await Position.bulkWrite(batch, {
          ordered: false,
        });

        console.log("Position performance batch:", {
          attempted: batch.length,
          matched: result.matchedCount,
          modified: result.modifiedCount,
        });
      } catch (error) {
        console.error("Position performance batch failed:", error);
      }
    }

    const snapshotTime = new Date();

    const walletIds = [...affectedWalletIds];
    const userIds = [...affectedUserIds];

    const walletResults = await Promise.allSettled(
      walletIds.map((walletId) =>
        walletSnapshotService.createWalletSnapshot(
          walletId,
          "cron_update",
          { timestamp: snapshotTime },
          null,
        ),
      ),
    );

    walletResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Wallet snapshot failed for ${walletIds[index]}:`,
          result.reason,
        );
      }
    });

    const portfolioResults = await Promise.allSettled(
      userIds.map((userId) =>
        portfolioService.createPortfolioSnapshot(
          userId,
          "cron_update",
          { timestamp: snapshotTime },
          null,
        ),
      ),
    );

    portfolioResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Portfolio snapshot failed for ${userIds[index]}:`,
          result.reason,
        );
      }
    });

    console.log("Position performance update completed:", {
      durationMs: Date.now() - startTime,
      updated: positionUpdates.length,
      skipped,
    });
  } catch (error) {
    console.error("Error in updatePositionsPerformance:", error);
    throw error;
  }
};

async function closeTradesInBatch(tradesToClose, closeTime) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const results = [];

    for (const {
      trade,
      currentValue,
      currentBaseValue,
      totalReturn,
      totalReturnPercent,
      closeReason,
    } of tradesToClose) {
      try {
        const marketValue = Number(currentBaseValue);
        const bonus = Number(trade.extra ?? 0);
        const entryCost = Number(
          trade.execution?.positionCost ??
            trade.execution?.positionAmount ??
            trade.execution?.amount,
        );
        const marginDebt = Number(trade.execution?.marginDebt ?? 0);
        const quantity = Number(trade.execution?.quantity ?? 0);

        if (
          !Number.isFinite(marketValue) ||
          marketValue < 0 ||
          !Number.isFinite(bonus) ||
          bonus < 0 ||
          !Number.isFinite(entryCost) ||
          entryCost < 0 ||
          !Number.isFinite(marginDebt) ||
          marginDebt < 0
        ) {
          throw new Error(`Invalid closing values for trade ${trade._id}`);
        }

        // Amount returned to the available wallet balance.
        const walletCredit = Number(
          (marketValue + bonus - marginDebt).toFixed(4),
        );

        if (walletCredit < 0) {
          throw new Error(
            `Closing credit cannot be negative for trade ${trade._id}`,
          );
        }

        // Principal was not deducted from totalBalance when buying,
        // so only realized P&L changes totalBalance on closing.
        const realizedProfitLoss = Number(
          (marketValue - entryCost + bonus).toFixed(4),
        );

        const realizedProfitLossPercent =
          Number(trade.execution?.amount) > 0
            ? Number(
                (
                  (realizedProfitLoss / Number(trade.execution.amount)) *
                  100
                ).toFixed(4),
              )
            : 0;

        // Close only if the trade is still open.
        const closeResult = await Trade.updateOne(
          { _id: trade._id, status: "open" },
          {
            $set: {
              status: "closed",
              closedAt: closeTime,
              closeReason,
              "targets.exitPoint": quantity > 0 ? marketValue / quantity : 0,
              "performance.currentBaseValue": marketValue,
              "performance.currentValue": Number(
                (marketValue + bonus).toFixed(4),
              ),
              "performance.totalReturn": realizedProfitLoss,
              "performance.totalReturnPercent": realizedProfitLossPercent,
            },
          },
          { session },
        );

        if (closeResult.modifiedCount === 0) {
          throw new Error(
            `Trade ${trade._id} was not closed because it is no longer open`,
          );
        }

        if (trade.wallet?.id) {
          const walletResult = await Wallet.updateOne(
            { _id: trade.wallet.id },
            {
              $inc: {
                "balance.available": walletCredit,
                "balance.totalBalance": realizedProfitLoss,
              },
            },
            { session },
          );

          if (walletResult.matchedCount === 0) {
            throw new Error(`Wallet not found for trade ${trade._id}`);
          }
        }

        await recordTradeInPortfolio(
          trade.userId,
          realizedProfitLoss,
          `Trade closed (${closeReason}). Realized P/L: ${realizedProfitLoss}`,
          // session,
        );

        results.push({
          success: true,
          tradeId: trade._id,
          realizedProfitLoss,
          walletCredit,
        });
      } catch (error) {
        throw new Error(
          `Failed to close trade ${trade._id}: ${error.message}`,
          { cause: error },
        );
      }
    }

    await session.commitTransaction();

    return results;
  } catch (error) {
    await session.abortTransaction();
    console.error("closeTradesInBatch failed:", error);
    throw error;
  } finally {
    await session.endSession();
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
        error.message,
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
        setTimeout(resolve, 1000 * Math.pow(2, attempt)),
      );
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getStartOfDay = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const captureDailyPositionPerformanceBaseline = async () => {
  const todayStart = getStartOfDay();

  const result = await Position.updateMany(
    {
      status: "open",
      "performance.currentBaseValue": { $type: "number" },
      $or: [
        {
          "performance.todayStartDate": { $lt: todayStart },
        },
        {
          "performance.todayStartDate": null,
        },
      ],
    },
    [
      {
        $set: {
          "performance.todayStartValue": "$performance.currentBaseValue",
          "performance.todayStartDate": todayStart,
          "performance.todayMarketReturn": 0,
          "performance.todayExtra": 0,
          "performance.todayReturn": 0,
          "performance.todayReturnPercent": 0,
        },
      },
    ],
  );

  console.log(
    `Daily position baseline captured at ${todayStart.toISOString()}. ` +
      `Updated ${result.modifiedCount} positions.`,
  );
};

const captureDailyTradePerformanceBaseline = async () => {
  const todayStart = getStartOfDay();

  const result = await Trade.updateMany(
    {
      status: "open",
      "performance.currentBaseValue": { $type: "number" },
      $or: [
        {
          "performance.todayStartDate": { $lt: todayStart },
        },
        {
          "performance.todayStartDate": null,
        },
      ],
    },
    [
      {
        $set: {
          "performance.todayStartValue": "$performance.currentBaseValue",
          "performance.todayStartDate": todayStart,
          "performance.todayMarketReturn": 0,
          "performance.todayExtra": 0,
          "performance.todayReturn": 0,
          "performance.todayReturnPercent": 0,
        },
      },
    ],
  );

  console.log(
    `Daily trade baseline captured at ${todayStart.toISOString()}. ` +
      `Updated ${result.modifiedCount} trades.`,
  );
};

module.exports = {
  updateTradePerformance,
  updateWalletPerformance,
  updateAssetsData,
  fetchAssetsWithRetry,
  updatePositionsPerformance,
  captureDailyPositionPerformanceBaseline,
  captureDailyTradePerformanceBaseline,
};
