const mongoose = require("mongoose");
const cron = require("node-cron");
const Chart = require("../models/Chart");
const Wallet = require("../models/Wallet");
const Trade = require("../models/Trade");
const { fetchAssets } = require("../services/assetService");

const BATCH_SIZE = process.env.CRON_BATCH_SIZE || 100;
const CRON_DELAY_MS = process.env.CRON_DELAY_MS || 300;

const updateTradePerformance = async () => {
	try {
		console.log("Starting trade performance update...");

		// Fetch all open trades
		const openTrades = await Trade.find({ status: "open" })
			.populate("userId", "name email") // Optional: populate user info if needed
			.exec();

		if (openTrades.length === 0) {
			console.log("No open trades found.");
			return;
		}

		console.log(`Found ${openTrades.length} open trades to update.`);

		// Get all unique asset symbols from open trades
		const assetSymbols = [
			...new Set(
				openTrades
					.filter((trade) => trade.asset && trade.asset.symbol)
					.map((trade) => trade.asset.symbol.toUpperCase())
			),
		];

		if (assetSymbols.length === 0) {
			console.log("No assets found in open trades.");
			return;
		}

		console.log(`Fetching current prices for ${assetSymbols.length} assets...`);

		// Fetch current asset data using your service
		let currentAssets;
		try {
			currentAssets = await fetchAssets(); // Your service function
		} catch (error) {
			console.error("Error fetching assets:", error.message);
			return;
		}

		// Create a map for quick lookup: symbol -> current price
		const assetPriceMap = {};
		currentAssets.forEach((asset) => {
			if (asset.symbol && asset.priceData && asset.priceData.current) {
				assetPriceMap[asset.symbol.toUpperCase()] = asset.priceData.current;
			}
		});

		// Update each trade
		const updatePromises = openTrades.map(async (trade) => {
			if (!trade.asset || !trade.asset.symbol) {
				console.log(`Trade ${trade._id} has no asset symbol, skipping.`);
				return null;
			}

			const symbol = trade.asset.symbol.toUpperCase();
			const currentPrice = assetPriceMap[symbol];

			if (!currentPrice) {
				console.log(
					`No current price found for ${symbol}, skipping trade ${trade._id}`
				);
				return null;
			}

			// Calculate performance metrics
			const executionPrice = trade.execution.price;
			const quantity = trade.execution.quantity;

			// Calculate current value
			const currentValue = currentPrice * quantity;

			// Calculate total return (current value - initial investment)
			const totalReturn = currentValue - trade.execution.amount;

			// Calculate total return percentage
			const totalReturnPercent = (totalReturn / trade.execution.amount) * 100;

			// For today's return, we need to compare with previous close
			// This would require storing yesterday's price or fetching historical data
			// For simplicity, we'll use the same calculation as total return
			const todayReturn = totalReturn;
			const todayReturnPercent = totalReturnPercent;

			// Update trade performance
			return Trade.findByIdAndUpdate(
				trade._id,
				{
					$set: {
						"performance.totalReturn": totalReturn,
						"performance.totalReturnPercent": totalReturnPercent,
						"performance.todayReturn": todayReturn,
						"performance.todayReturnPercent": todayReturnPercent,
						"performance.currentValue": currentValue,
						updatedAt: new Date(),
					},
				},
				{ new: true }
			);
		});

		// Wait for all updates to complete
		const results = await Promise.all(updatePromises);
		const successfulUpdates = results.filter((result) => result !== null);

		console.log(`Successfully updated ${successfulUpdates.length} trades.`);
	} catch (error) {
		console.error("Error in updateTradePerformance:", error);
	}
};

async function updatePorfolioChart(timeframe) {
	const startTime = Date.now();
	let usersProcessed = 0;

	try {
		console.log(`[${new Date().toISOString()}] Starting ${timeframe} update`);

		let skip = 0;
		let shouldContinue = true;

		while (shouldContinue) {
			const userIds = await Wallet.distinct(
				"userId",
				{},
				{ skip, limit: BATCH_SIZE }
			);
			if (userIds.length === 0) {
				shouldContinue = false;
				break;
			}

			const userBalances = await Wallet.aggregate([
				{ $match: { userId: { $in: userIds } } },
				{
					$group: {
						_id: "$userId",
						totalBalance: { $sum: "$totalBalance" },
						walletCount: { $sum: 1 }, // For validation
					},
				},
			]);

			// Validate we found all wallets
			if (userBalances.some((u) => u.walletCount !== 3)) {
				console.warn("Some users have missing wallets!");
			}

			const bulkOps = userBalances.map((user) => ({
				updateOne: {
					filter: { userId: user._id },
					update: {
						$push: {
							[`history.${timeframe}`]: {
								timestamp: new Date(),
								balance: user.totalBalance,
								metadata: { walletCount: user.walletCount },
							},
						},
						$set: { lastUpdated: new Date() },
					},
					upsert: true,
				},
			}));

			const result = await Chart.bulkWrite(bulkOps);
			usersProcessed += userIds.length;
			skip += BATCH_SIZE;

			console.log(
				`Processed batch: ${usersProcessed} users | ${result.modifiedCount} updated`
			);

			if (process.env.NODE_ENV === "development") {
				// Faster iteration in dev
				shouldContinue = false;
			} else {
				await new Promise((resolve) => setTimeout(resolve, CRON_DELAY_MS));
			}
		}

		console.log(
			`✅ Completed ${timeframe} update for ${usersProcessed} users in ${
				(Date.now() - startTime) / 1000
			}s`
		);
	} catch (error) {
		console.error(
			`❌ ${timeframe} update failed after ${usersProcessed} users:`,
			error
		);
		// Consider adding retry logic here
	}
}

module.exports = {
	updateTradePerformance,
	updatePorfolioChart,
};
