const cron = require("node-cron");
const Chart = require("../models/Chart");
const Wallet = require("../models/Wallet");
require("dotenv").config();

const BATCH_SIZE = process.env.CRON_BATCH_SIZE || 100;
const CRON_DELAY_MS = process.env.CRON_DELAY_MS || 300;

// Track active jobs for graceful shutdown
const activeJobs = new Set();

async function updateWalletGrowth(timeframe) {
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

function initWalletGrowthCronJobs() {
	if (process.env.NODE_ENV === "development" && !process.env.ENABLE_CRONS) {
		console.log(
			"⏸️  Cron jobs disabled in development (set ENABLE_CRONS=1 to enable)"
		);
		return;
	}

	// Schedule with override for testing
	const schedules = {
		hourly: process.env.CRON_HOURLY || "0 * * * *",
		daily: process.env.CRON_DAILY || "0 0 * * *",
		weekly: process.env.CRON_WEEKLY || "0 0 * * 0",
		monthly: process.env.CRON_MONTHLY || "0 0 1 * *",
		yearly: process.env.CRON_YEARLY || "0 0 1 1 *",
	};

	Object.entries(schedules).forEach(([timeframe, schedule]) => {
		const job = cron.schedule(schedule, () => updateWalletGrowth(timeframe), {
			scheduled:
				process.env.NODE_ENV === "production" || !!process.env.ENABLE_CRONS,
		});
		activeJobs.add(job);
	});

	console.log(
		`🟢 Initialized ${activeJobs.size} cron jobs in ${process.env.NODE_ENV} mode`
	);
}

function shutdownCronJobs() {
	activeJobs.forEach((job) => job.stop());
	console.log(`🛑 Stopped ${activeJobs.size} cron jobs`);
}

// Handle manual triggers in development
if (process.env.NODE_ENV === "development") {
	const express = require("express");
	const devRouter = express.Router();

	devRouter.get("/trigger/:timeframe", async (req, res) => {
		await updateWalletGrowth(req.params.timeframe);
		res.json({ status: "completed" });
	});

	module.exports = { initWalletGrowthCronJobs, shutdownCronJobs, devRouter };
} else {
	module.exports = { initWalletGrowthCronJobs, shutdownCronJobs };
}
