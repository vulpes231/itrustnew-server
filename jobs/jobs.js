const cron = require("node-cron");
const {
	updatePortfolioChart,
	updateTradePerformance,
	updateWalletPerformance,
} = require("./customJobs");
require("dotenv").config();

// Track active jobs for graceful shutdown
const activeJobs = new Set();
// Track when jobs were last run to prevent overlap
const lastRunTimestamps = new Map();

function initCronJobs() {
	if (process.env.NODE_ENV === "development" && !process.env.ENABLE_CRONS) {
		console.log(
			"⏸️  Cron jobs disabled in development (set ENABLE_CRONS=1 to enable)"
		);
		return;
	}

	const schedules = {
		walletPerformance: process.env.CRON_WALLET_PERFORMANCE || "0 1 * * *", //1am daily
		tradePerformance: process.env.CRON_TRADE_PERFORMANCE || "0 * * * *", // Hourly
		portfolioHourly: process.env.CRON_HOURLY || "0 * * * *",
		portfolioDaily: process.env.CRON_DAILY || "0 0 * * *",
		portfolioWeekly: process.env.CRON_WEEKLY || "0 0 * * 0",
		portfolioMonthly: process.env.CRON_MONTHLY || "0 0 1 * *",
		portfolioYearly: process.env.CRON_YEARLY || "0 0 1 1 *",
	};

	const walletJob = cron.schedule(
		schedules.walletPerformance,
		async () => {
			await updateWalletPerformance();
		},
		{
			scheduled:
				process.env.NODE_ENV === "production" || !!process.env.ENABLE_CRONS,
		}
	);
	activeJobs.add(walletJob);

	// Trade performance job (hourly)
	const tradeJob = cron.schedule(
		schedules.tradePerformance,
		async () => {
			// Prevent overlapping executions
			const now = Date.now();
			const lastRun = lastRunTimestamps.get("tradePerformance") || 0;

			// If last run was less than 55 minutes ago, skip this execution
			if (now - lastRun < 55 * 60 * 1000) {
				console.log(
					"Skipping trade performance update - previous execution still recent"
				);
				return;
			}

			lastRunTimestamps.set("tradePerformance", now);
			try {
				await updateTradePerformance();
			} catch (error) {
				console.error("Trade performance update failed:", error);
			}
		},
		{
			scheduled:
				process.env.NODE_ENV === "production" || !!process.env.ENABLE_CRONS,
		}
	);
	activeJobs.add(tradeJob);

	// Portfolio chart jobs
	Object.entries(schedules).forEach(([timeframe, schedule]) => {
		if (timeframe === "tradePerformance") return;
		if (timeframe === "walletPerformance") return;

		const job = cron.schedule(
			schedule,
			() => {
				// Only update portfolio charts, not trade performance
				updatePortfolioChart(timeframe.replace("portfolio", "").toLowerCase());
			},
			{
				scheduled:
					process.env.NODE_ENV === "production" || !!process.env.ENABLE_CRONS,
			}
		);
		activeJobs.add(job);
	});

	console.log(
		`🟢 Initialized ${activeJobs.size} cron jobs in ${process.env.NODE_ENV} mode`
	);
}

function shutdownCronJobs() {}

// Add a function to manually trigger trade performance updates
function manuallyTriggerTradePerformance() {
	console.log("Manually triggering trade performance update");
	updateTradePerformance().catch(console.error);
}

// Handle manual triggers in development
if (process.env.NODE_ENV === "development") {
	const express = require("express");
	const devRouter = express.Router();

	devRouter.get("/trigger/:timeframe", async (req, res) => {
		await updatePortfolioChart(req.params.timeframe);
		res.json({ status: "completed" });
	});

	devRouter.get("/performance", async (req, res) => {
		await updateTradePerformance();
		res.json({ status: "completed" });
	});

	module.exports = {
		initCronJobs,
		shutdownCronJobs,
		devRouter,
		manuallyTriggerTradePerformance,
	};
} else {
	module.exports = {
		initCronJobs,
		shutdownCronJobs,
		manuallyTriggerTradePerformance,
	};
}
