const cron = require("node-cron");
const {
  updateTradePerformance,
  updateWalletPerformance,
  updateAssetsData,
} = require("./customJobs");
require("dotenv").config();

const activeJobs = new Set();
const lastRunTimestamps = new Map();

const enableCrons =
  process.env.NODE_ENV === "production" || process.env.ENABLE_CRONS === "1";

function initCronJobs() {
  if (!enableCrons) {
    console.log(
      "Cron jobs disabled (NODE_ENV=development and ENABLE_CRONS !== 1)"
    );
    return;
  }

  const schedules = {
    assetUpdate: process.env.CRON_ASSET_UPDATE || "0 9,13,17 * * *",
    walletPerformance: process.env.CRON_WALLET_PERFORMANCE || "0 1 * * *",
    tradePerformance: process.env.CRON_TRADE_PERFORMANCE || "0 * * * *",
  };

  const assetUpdateJob = cron.schedule(
    schedules.assetUpdate,
    async () => {
      const jobName = "assetUpdate";
      const now = Date.now();
      const lastRun = lastRunTimestamps.get(jobName) || 0;

      if (now - lastRun < 30 * 60 * 1000) {
        console.log("Skipping asset update - previous execution still recent");
        return;
      }

      lastRunTimestamps.set(jobName, now);

      try {
        console.log(
          `Starting scheduled asset update at ${new Date().toISOString()}`
        );
        await updateAssetsData();
        console.log(
          `Scheduled asset update completed at ${new Date().toISOString()}`
        );
      } catch (error) {
        console.error("Scheduled asset update failed:", error);
      }
    },
    {
      scheduled: enableCrons,
    }
  );

  activeJobs.add(assetUpdateJob);

  const walletJob = cron.schedule(
    schedules.walletPerformance,
    async () => {
      await updateWalletPerformance();
    },
    { scheduled: enableCrons }
  );
  activeJobs.add(walletJob);

  const tradeJob = cron.schedule(
    schedules.tradePerformance,
    async () => {
      const now = Date.now();
      const lastRun = lastRunTimestamps.get("tradePerformance") || 0;

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
    { scheduled: enableCrons }
  );
  activeJobs.add(tradeJob);

  console.log(
    `Initialized ${activeJobs.size} cron jobs in ${
      process.env.NODE_ENV
    } mode (ENABLE_CRONS=${process.env.ENABLE_CRONS || "unset"})`
  );
}

function shutdownCronJobs() {
  if (activeJobs.size === 0) {
    console.log("⚪ No cron jobs to shutdown");
    return;
  }

  console.log(`🛑 Shutting down ${activeJobs.size} cron jobs...`);
  for (const job of activeJobs) {
    try {
      job.stop(); // stop the cron schedule
    } catch (err) {
      console.error("Error stopping job:", err);
    }
  }
  activeJobs.clear();
  console.log("✅ All cron jobs stopped");
}

if (process.env.NODE_ENV === "development") {
  const express = require("express");
  const devRouter = express.Router();

  devRouter.get("/performance", async (req, res) => {
    await updateTradePerformance();
    res.json({ status: "completed" });
  });

  module.exports = {
    initCronJobs,
    shutdownCronJobs,
    devRouter,
  };
} else {
  module.exports = {
    initCronJobs,
    shutdownCronJobs,
  };
}
