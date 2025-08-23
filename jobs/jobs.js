const cron = require("node-cron");
const {
	updatePortfolioChart,
	updateTradePerformance,
} = require("./customJobs");
require("dotenv").config();

// Track active jobs for graceful shutdown
const activeJobs = new Set();

function initCronJobs() {
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
		const job = cron.schedule(
			schedule,
			() => {
				updatePortfolioChart(timeframe);
				updateTradePerformance();
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

function shutdownCronJobs() {
	activeJobs.forEach((job) => job.stop());
	console.log(`🛑 Stopped ${activeJobs.size} cron jobs`);
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

	module.exports = { initCronJobs, shutdownCronJobs, devRouter };
} else {
	module.exports = { initCronJobs, shutdownCronJobs };
}
