const cron = require("node-cron");
const {
  updateTradePerformance,
  updateWalletPerformance,
  updateAssetsData,
  updatePositionsPerformance,
} = require("./customJobs");
require("dotenv").config();

const activeJobs = new Set();
const lastRunTimestamps = new Map();

const enableCrons =
  process.env.NODE_ENV === "production" || process.env.ENABLE_CRONS === "1";

function initCronJobs() {
  if (!enableCrons) {
    console.log(
      "Cron jobs disabled (NODE_ENV=development and ENABLE_CRONS !== 1)",
    );
    return;
  }

  const schedules = {
    assetUpdate: process.env.CRON_ASSET_UPDATE || "0 9,13,17 * * *",
    walletPerformance: process.env.CRON_WALLET_PERFORMANCE || "0 1 * * *",
    tradePerformance: process.env.CRON_TRADE_PERFORMANCE || "*/30 * * * *",
    positionPerformance:
      process.env.CRON_POSITION_PERFORMANCE || "*/30 * * * *",
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
          `Starting scheduled asset update at ${new Date().toISOString()}`,
        );
        await updateAssetsData();
        console.log(
          `Scheduled asset update completed at ${new Date().toISOString()}`,
        );
      } catch (error) {
        console.error("Scheduled asset update failed:", error);
      }
    },
    {
      scheduled: enableCrons,
    },
  );
  activeJobs.add(assetUpdateJob);

  const walletJob = cron.schedule(
    schedules.walletPerformance,
    async () => {
      try {
        console.log(
          `Starting wallet performance update at ${new Date().toISOString()}`,
        );
        await updateWalletPerformance();
        console.log(
          `Wallet performance update completed at ${new Date().toISOString()}`,
        );
      } catch (error) {
        console.error("Wallet performance update failed:", error);
      }
    },
    { scheduled: enableCrons },
  );
  activeJobs.add(walletJob);

  const tradeJob = cron.schedule(
    schedules.tradePerformance,
    async () => {
      const now = Date.now();
      const lastRun = lastRunTimestamps.get("tradePerformance") || 0;

      if (now - lastRun < 55 * 60 * 1000) {
        console.log(
          "Skipping trade performance update - previous execution still recent",
        );
        return;
      }

      lastRunTimestamps.set("tradePerformance", now);
      try {
        console.log(
          `Starting trade performance update at ${new Date().toISOString()}`,
        );
        await updateTradePerformance();
        console.log(
          `Trade performance update completed at ${new Date().toISOString()}`,
        );
      } catch (error) {
        console.error("Trade performance update failed:", error);
      }
    },
    { scheduled: enableCrons },
  );
  activeJobs.add(tradeJob);

  const positionJob = cron.schedule(
    schedules.positionPerformance,
    async () => {
      const now = Date.now();
      const lastRun = lastRunTimestamps.get("positionPerformance") || 0;

      if (now - lastRun < 8 * 60 * 1000) {
        console.log(
          "Skipping position performance update - previous execution still recent",
        );
        return;
      }

      lastRunTimestamps.set("positionPerformance", now);
      try {
        console.log(
          `Starting position performance update at ${new Date().toISOString()}`,
        );
        await updatePositionsPerformance();
        console.log(
          `Position performance update completed at ${new Date().toISOString()}`,
        );
      } catch (error) {
        console.error("Position performance update failed:", error);
      }
    },
    { scheduled: enableCrons },
  );
  activeJobs.add(positionJob);

  console.log(
    `Initialized ${activeJobs.size} cron jobs in ${
      process.env.NODE_ENV
    } mode (ENABLE_CRONS=${process.env.ENABLE_CRONS || "unset"})`,
  );
  console.log(`Job schedules:`, schedules);
}

function shutdownCronJobs() {
  if (activeJobs.size === 0) {
    console.log("No cron jobs to shutdown");
    return;
  }

  console.log(`Shutting down ${activeJobs.size} cron jobs...`);
  for (const job of activeJobs) {
    try {
      job.stop();
    } catch (err) {
      console.error("Error stopping job:", err);
    }
  }
  activeJobs.clear();
  console.log("All cron jobs stopped");
}

if (process.env.NODE_ENV === "development") {
  const express = require("express");
  const devRouter = express.Router();

  devRouter.get("/performance", async (req, res) => {
    try {
      await updateTradePerformance();
      res.json({ status: "completed", type: "trade" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  devRouter.get("/positions", async (req, res) => {
    try {
      await updatePositionsPerformance();
      res.json({ status: "completed", type: "position" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  devRouter.get("/all", async (req, res) => {
    try {
      await updateTradePerformance();
      await updatePositionsPerformance();
      res.json({ status: "completed", type: "all" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
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
