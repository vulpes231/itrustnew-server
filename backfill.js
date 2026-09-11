import mongoose from "mongoose";
import dotenv from "dotenv";
import Transaction from "./models/Transaction.js";
import { setServers } from "node:dns/promises";

setServers(["1.1.1.1", "8.8.8.8"]);

dotenv.config();

const MONGO_URI = process.env.DATABASE_URI;

function detectMethod(memo) {
  const comment = (memo || "").toLowerCase().trim();

  // USDT TRC20
  if (comment.includes("usdt") && comment.includes("trc20")) {
    return {
      mode: "usdt",
      network: "trc20",
    };
  }

  // USDT ERC20
  if (comment.includes("usdt") && comment.includes("erc20")) {
    return {
      mode: "usdt",
      network: "erc20",
    };
  }

  // Generic USDT defaults to ERC20
  if (comment.includes("usdt")) {
    return {
      mode: "usdt",
      network: "erc20",
    };
  }

  // BTC / Bitcoin
  if (comment.includes("btc") || comment.includes("bitcoin")) {
    return {
      mode: "btc",
      network: "btc",
    };
  }

  // ETH / Ethereum
  if (comment.includes("eth") || comment.includes("ethereum")) {
    return {
      mode: "eth",
      network: "erc20",
    };
  }

  // Bank deposits/withdrawals
  if (comment.includes("bank")) {
    return {
      mode: "bank",
      network: "bank",
    };
  }

  // Anything else, including "Cash", defaults to BTC
  return {
    mode: "btc",
    network: "btc",
  };
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("Connected to MongoDB");

    const transactions = await Transaction.find(
      {},
      {
        _id: 1,
        memo: 1,
        method: 1,
      },
    ).lean();

    console.log(`Found ${transactions.length} transactions`);

    const summary = {
      btc: 0,
      eth: 0,
      bank: 0,
      usdtErc20: 0,
      usdtTrc20: 0,
    };

    const bulkOperations = [];

    for (const transaction of transactions) {
      const method = detectMethod(transaction.memo);

      if (method.mode === "btc") {
        summary.btc++;
      } else if (method.mode === "eth") {
        summary.eth++;
      } else if (method.mode === "bank") {
        summary.bank++;
      } else if (method.mode === "usdt" && method.network === "erc20") {
        summary.usdtErc20++;
      } else if (method.mode === "usdt" && method.network === "trc20") {
        summary.usdtTrc20++;
      }

      bulkOperations.push({
        updateOne: {
          filter: {
            _id: transaction._id,
          },
          update: {
            $set: {
              "method.mode": method.mode,
              "method.network": method.network,
            },
          },
        },
      });
    }

    if (bulkOperations.length > 0) {
      const result = await Transaction.bulkWrite(bulkOperations);

      console.log(`\nUpdated ${result.modifiedCount} transactions`);
    }

    console.log("\nMethod detection summary");
    console.log("------------------------");
    console.log(`BTC:          ${summary.btc}`);
    console.log(`ETH:          ${summary.eth}`);
    console.log(`BANK:         ${summary.bank}`);
    console.log(`USDT ERC20:   ${summary.usdtErc20}`);
    console.log(`USDT TRC20:   ${summary.usdtTrc20}`);
    console.log(`Total:        ${transactions.length}`);
  } catch (error) {
    console.error("\nBackfill failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
