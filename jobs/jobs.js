const cron = require("node-cron");
const {
  updateTradePerformance,
  updateWalletPerformance,
  updateAssetsData,
  updatePositionsPerformance,
  captureDailyPositionPerformanceBaseline,
  captureDailyTradePerformanceBaseline,
} = require("./customJobs");
require("dotenv").config();

const activeJobs = new Set();
const lastRunTimestamps = new Map();

const enableCrons =
  process.env.NODE_ENV === "production" || process.env.ENABLE_CRONS === "1";

const runningJobs = new Set();

async function runWithLock(jobName, task) {
  if (runningJobs.has(jobName)) {
    console.warn(
      `[CRON] Skipping ${jobName}: previous execution is still running`,
    );
    return;
  }

  runningJobs.add(jobName);

  const startedAt = Date.now();

  try {
    console.log(`[CRON] ${jobName} started`);

    await task();

    console.log(`[CRON] ${jobName} completed in ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error(`[CRON] ${jobName} failed:`, error);
  } finally {
    runningJobs.delete(jobName);
  }
}

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
    positionBaseline: process.env.CRON_POSITION_BASELINE || "0 0 * * *",
  };

  const positionBaselineJob = cron.schedule(
    schedules.positionBaseline,
    async () => {
      const jobName = "positionBaseline";

      try {
        console.log(
          `Starting daily performance baseline at ${new Date().toISOString()}`,
        );

        lastRunTimestamps.set(jobName, Date.now());

        await Promise.all([
          captureDailyPositionPerformanceBaseline(),
          captureDailyTradePerformanceBaseline(),
        ]);

        console.log(
          `Daily performance baseline completed at ${new Date().toISOString()}`,
        );
      } catch (error) {
        console.error("Daily performance baseline update failed:", error);
      }
    },
    {
      scheduled: enableCrons,
    },
  );

  activeJobs.add(positionBaselineJob);

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
    () => runWithLock("tradePerformance", updateTradePerformance),
    { scheduled: enableCrons },
  );

  activeJobs.add(tradeJob);

  const positionJob = cron.schedule(
    schedules.positionPerformance,
    () => runWithLock("positionPerformance", updatePositionsPerformance),
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
