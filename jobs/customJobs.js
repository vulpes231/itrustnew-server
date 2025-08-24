// const mongoose = require("mongoose");
// const cron = require("node-cron");
const Chart = require("../models/Chart");
const Wallet = require("../models/Wallet");
const Trade = require("../models/Trade");
const { fetchAssets } = require("../services/assetService");
const User = require("../models/User");
const { logEvent } = require("../middlewares/loggers");

const BATCH_SIZE = process.env.CRON_BATCH_SIZE || 100;
const CRON_DELAY_MS = process.env.CRON_DELAY_MS || 300;

const updateTradePerformance = async () => {
	try {
		console.log("Starting trade performance update...");
		const startTime = Date.now();

		// Fetch all open trades
		const openTrades = await Trade.find({ status: "open" })
			.populate("userId", "name email")
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

		// Fetch current asset data with retry logic
		let currentAssets;
		try {
			currentAssets = await fetchAssetsWithRetry(assetSymbols);
		} catch (error) {
			console.error("Error fetching assets after retries:", error.message);
			return;
		}

		// Create a map for quick lookup: symbol -> current price
		const assetPriceMap = {};
		currentAssets.forEach((asset) => {
			if (asset.symbol && asset.priceData && asset.priceData.current) {
				assetPriceMap[asset.symbol.toUpperCase()] = asset.priceData.current;
			}
		});

		// Process trades in batches to avoid overwhelming the database
		const BATCH_SIZE = 50; // Adjust based on your system capacity
		let successfulUpdates = 0;

		for (let i = 0; i < openTrades.length; i += BATCH_SIZE) {
			const batch = openTrades.slice(i, i + BATCH_SIZE);
			console.log(
				`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(
					openTrades.length / BATCH_SIZE
				)}`
			);

			const batchPromises = batch.map(async (trade) => {
				return updateSingleTrade(trade, assetPriceMap);
			});

			try {
				const batchResults = await Promise.all(batchPromises);
				successfulUpdates += batchResults.filter(
					(result) => result !== null
				).length;

				// Small delay between batches to avoid overwhelming the system
				if (i + BATCH_SIZE < openTrades.length) {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			} catch (error) {
				console.error(`Error processing batch starting at index ${i}:`, error);
			}
		}

		const duration = Date.now() - startTime;
		console.log(
			`Successfully updated ${successfulUpdates} trades in ${duration}ms.`
		);
	} catch (error) {
		console.error("Error in updateTradePerformance:", error);
	}
};

// Helper function to fetch assets with retry logic
async function fetchAssetsWithRetry(assetSymbols, maxRetries = 3) {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			console.log(`Fetching assets (attempt ${attempt}/${maxRetries})...`);
			const assets = await fetchAssets(); // Your existing service function

			// Verify we got data for all requested symbols
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

// Helper function to update a single trade
async function updateSingleTrade(trade, assetPriceMap) {
	try {
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
		await Trade.findByIdAndUpdate(
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

		return trade._id; // Return the ID to count successful updates
	} catch (error) {
		console.error(`Error updating trade ${trade._id}:`, error.message);
		return null;
	}
}

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

		const msg = `✅ Completed ${timeframe} update for ${usersProcessed} users in ${
			(Date.now() - startTime) / 1000
		}s`;
		logEvent(msg, "cron.txt\n");
		console.log(msg);
	} catch (error) {
		console.error(
			`❌ ${timeframe} update failed after ${usersProcessed} users:`,
			error
		);
		// Consider adding retry logic here
	}
}

// =========================================================

async function updateWalletPerformance() {
	console.log("Starting Wallet performance update...");
	const startTime = Date.now();

	try {
		// Get all users
		const users = await User.find().select("_id");

		if (users.length === 0) {
			console.log("No users found.");
			return;
		}

		console.log(`Found ${users.length} users to update.`);

		// Process users in batches
		const BATCH_SIZE = 20;
		let updatedWallets = 0;

		for (let i = 0; i < users.length; i += BATCH_SIZE) {
			const userBatch = users.slice(i, i + BATCH_SIZE);
			console.log(
				`Processing user batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
					users.length / BATCH_SIZE
				)}`
			);

			for (const user of userBatch) {
				try {
					// Get all wallets for this user
					const userWallets = await Wallet.find({ userId: user._id });

					if (userWallets.length === 0) {
						console.log(`No wallets found for user ${user._id}`);
						continue;
					}

					// Get all open trades for this user
					const userTrades = await Trade.find({
						userId: user._id,
						status: "open",
					});

					if (userTrades.length === 0) {
						console.log(`No open trades found for user ${user._id}`);
						// Reset daily profits if no open trades
						await resetWalletDailyProfits(userWallets);
						continue;
					}

					// Calculate daily profit for each wallet
					for (const wallet of userWallets) {
						const walletTrades = userTrades.filter(
							(trade) =>
								trade.wallet.id &&
								trade.wallet.id.toString() === wallet._id.toString()
						);

						if (walletTrades.length === 0) {
							// No trades in this wallet, reset daily profit
							await Wallet.findByIdAndUpdate(wallet._id, {
								dailyProfit: 0,
								dailyProfitPercent: 0,
							});
							continue;
						}

						// Calculate total daily profit and percent for this wallet
						const totalDailyProfit = walletTrades.reduce(
							(sum, trade) => sum + (trade.performance.todayReturn || 0),
							0
						);

						// Calculate total investment in this wallet
						const totalInvestment = walletTrades.reduce(
							(sum, trade) => sum + (trade.execution.amount || 0),
							0
						);

						// Calculate daily profit percentage
						const dailyProfitPercent =
							totalInvestment > 0
								? (totalDailyProfit / totalInvestment) * 100
								: 0;

						// Update wallet with calculated values
						await Wallet.findByIdAndUpdate(wallet._id, {
							dailyProfit: totalDailyProfit,
							dailyProfitPercent: dailyProfitPercent,
						});

						updatedWallets++;
					}
				} catch (userError) {
					console.error(
						`Error processing user ${user._id}:`,
						userError.message
					);
				}
			}

			// Small delay between batches
			if (i + BATCH_SIZE < users.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		const duration = Date.now() - startTime;

		const msg = `Successfully updated ${updatedWallets} wallets in ${duration}ms.`;
		logEvent(msg, "cron.txt\n");
		console.log(msg);
	} catch (error) {
		console.error("Error in updateWalletPerformance:", error);
	}
}

// Helper function to reset daily profits when no trades exist
async function resetWalletDailyProfits(wallets) {
	const updatePromises = wallets.map((wallet) =>
		Wallet.findByIdAndUpdate(wallet._id, {
			dailyProfit: 0,
			dailyProfitPercent: 0,
		})
	);

	await Promise.all(updatePromises);
}

// Optional: Function to update a single user's wallet performance
// async function updateSingleUserWalletPerformance(userId) {
// 	try {
// 		console.log(`Updating wallet performance for user ${userId}`);

// 		// Get user wallets
// 		const userWallets = await Wallet.find({ userId });

// 		if (userWallets.length === 0) {
// 			console.log(`No wallets found for user ${userId}`);
// 			return;
// 		}

// 		// Get user's open trades
// 		const userTrades = await Trade.find({
// 			userId,
// 			status: "open",
// 		});

// 		if (userTrades.length === 0) {
// 			console.log(`No open trades found for user ${userId}`);
// 			await resetWalletDailyProfits(userWallets);
// 			return;
// 		}

// 		// Update each wallet
// 		for (const wallet of userWallets) {
// 			const walletTrades = userTrades.filter(
// 				(trade) =>
// 					trade.wallet.id &&
// 					trade.wallet.id.toString() === wallet._id.toString()
// 			);

// 			if (walletTrades.length === 0) {
// 				await Wallet.findByIdAndUpdate(wallet._id, {
// 					dailyProfit: 0,
// 					dailyProfitPercent: 0,
// 				});
// 				continue;
// 			}

// 			const totalDailyProfit = walletTrades.reduce(
// 				(sum, trade) => sum + (trade.performance.todayReturn || 0),
// 				0
// 			);

// 			const totalInvestment = walletTrades.reduce(
// 				(sum, trade) => sum + (trade.execution.amount || 0),
// 				0
// 			);

// 			const dailyProfitPercent =
// 				totalInvestment > 0 ? (totalDailyProfit / totalInvestment) * 100 : 0;

// 			await Wallet.findByIdAndUpdate(wallet._id, {
// 				dailyProfit: totalDailyProfit,
// 				dailyProfitPercent: dailyProfitPercent,
// 			});
// 		}

// 		console.log(`Successfully updated wallets for user ${userId}`);
// 	} catch (error) {
// 		console.error(
// 			`Error updating wallet performance for user ${userId}:`,
// 			error
// 		);
// 	}
// }

module.exports = {
	updateTradePerformance,
	updatePorfolioChart,
	updateWalletPerformance,
};
