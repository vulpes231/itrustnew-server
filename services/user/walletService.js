const Trade = require("../../models/Trade");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");

async function fetchUserWallets(userId) {
  try {
    const wallets = await Wallet.find({ userId: userId }).lean();

    return wallets;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function getUserFinancialSummary(userId) {
  try {
    if (!userId) {
      throw new CustomError("User ID is required", 400);
    }

    const [wallets, userTrades] = await Promise.all([
      Wallet.find({ userId }),
      Trade.find({ userId }),
    ]);

    if (wallets.length === 0 && userTrades.length === 0) {
      return {
        totalBalance: 0,
        availableBalance: 0,
        dailyProfit: 0,
        dailyProfitPercent: 0,
        totalProfitPercent: 0,
        totalInvested: 0,
        totalProfit: 0,
        cashBalance: 0,
      };
    }

    const cash = wallets.find((wallet) => wallet.slug === "cash");

    const totalBalance = wallets.reduce(
      (sum, wallet) => sum + (wallet.balance.total || 0),
      0,
    );
    const availableBalance = wallets.reduce(
      (sum, wallet) => sum + (wallet.balance.available || 0),
      0,
    );

    const dailyProfit = wallets.reduce(
      (sum, wallet) => sum + (wallet.dailyProfit || 0),
      0,
    );

    const dailyProfitPercent =
      totalBalance > 0 ? (dailyProfit / totalBalance) * 100 : 0;

    const totalInvested = userTrades.reduce(
      (sum, trade) => sum + (trade.performance?.currentValue || 0),
      0,
    );

    const totalProfit = userTrades.reduce(
      (sum, trade) => sum + (trade.performance?.totalReturn || 0),
      0,
    );

    const totalProfitPercent =
      totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    const cashBalance = cash.balance.available;

    const openTrades = userTrades.filter((trade) => trade.status === "open");

    const totalOpenProfit = openTrades.reduce(
      (sum, trade) => sum + (trade.performance?.totalReturn || 0),
      0,
    );

    const totalAccountBalance = totalBalance + totalProfit;

    return {
      totalBalance: totalAccountBalance,
      availableBalance,
      dailyProfit,
      dailyProfitPercent: Number(dailyProfitPercent.toFixed(2)),
      totalProfit,
      totalProfitPercent: Number(totalProfitPercent.toFixed(2)),
      totalInvested,
      cashBalance,
      assetsOwned: openTrades.length,
    };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, error.statusCode);
  }
}

async function getWalletInvestData(userId) {
  try {
    const [accounts, trades] = await Promise.all([
      Wallet.find({ userId }),
      Trade.find({ userId }),
      // Trade.find({ userId }),
    ]);

    const brokerageAcct = accounts.find((acct) => acct.slug === "brokerage");
    const investAcct = accounts.find((acct) => acct.slug === "auto");

    if (!brokerageAcct || !investAcct) {
      throw new CustomError("Required accounts not found", 404);
    }

    const brokerageId = brokerageAcct._id.toString();
    const investId = investAcct._id.toString();

    const openTrades = trades.filter((trade) => trade.status === "open");

    const totals = openTrades.reduce(
      (acc, trade) => {
        const walletId = trade.wallet.id.toString();
        const interest = trade.extra || 0;
        const currentValue = trade.performance.currentValue || 0;
        const profitLoss = (trade.performance?.totalReturn || 0) + interest;

        if (walletId === brokerageId) {
          acc.brokerage.profitLoss += profitLoss;
          acc.brokerage.currentValue += currentValue;
        } else if (walletId === investId) {
          acc.auto.profitLoss += profitLoss;
          acc.auto.currentValue += currentValue;
        }

        return acc;
      },
      {
        brokerage: { profitLoss: 0, currentValue: 0 },
        auto: { profitLoss: 0, currentValue: 0 },
      },
    );

    return {
      brokerage: {
        totalProfitLoss: totals.brokerage.profitLoss,
        totalInvested: totals.brokerage.currentValue,
      },
      auto: {
        totalProfitLoss: totals.auto.profitLoss,
        totalInvested: totals.auto.currentValue,
      },
      default: {
        totalProfitLoss: totals.auto.profitLoss + totals.brokerage.profitLoss,
        totalInvested: totals.brokerage.currentValue + totals.auto.currentValue,
      },
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;

    throw new CustomError(
      error.message || "Failed to fetch wallet investment data",
      error.statusCode || 500,
    );
  }
}

module.exports = {
  fetchUserWallets,
  getUserFinancialSummary,
  getWalletInvestData,
};
