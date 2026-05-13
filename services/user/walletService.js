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

    const cashBalance = cash.availableBalance;

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
    ]);

    const brokerageAcct = accounts.find((acct) => acct.slug === "brokerage");
    const investAcct = accounts.find((acct) => acct.slug === "auto");

    if (!brokerageAcct || !investAcct) {
      throw new CustomError("Required accounts not found", 404);
    }

    const brokerageId = brokerageAcct._id.toString();
    const investId = investAcct._id.toString();

    const openTrades = trades.filter((trade) => trade.status === "open");

    // const totalOpenProfit = openTrades.reduce(
    //   (sum, trade) => sum + (trade.performance?.totalReturn || 0),
    //   0,
    // );
    const totals = trades.reduce(
      (acc, trade) => {
        const walletId = trade.wallet.id.toString();
        const amount = trade.execution.amount;
        const interest = trade.extra || 0;
        const profitLoss = (trade.performance?.totalReturn || 0) + interest;

        if (walletId === brokerageId) {
          acc.brokerage.invested += amount;
          acc.brokerage.profitLoss += profitLoss;
        } else if (walletId === investId) {
          acc.auto.invested += amount;
          acc.auto.profitLoss += profitLoss;
        }

        return acc;
      },
      {
        brokerage: { invested: 0, profitLoss: 0 },
        auto: { invested: 0, profitLoss: 0 },
      },
    );

    const totalBrokerage =
      totals.brokerage.profitLoss + totals.brokerage.invested;
    const totalAuto = totals.auto.profitLoss + totals.auto.invested;

    return {
      brokerage: {
        totalProfitLoss: totals.brokerage.profitLoss,
        totalInvested: totalBrokerage,
      },
      auto: {
        totalProfitLoss: totals.auto.profitLoss,
        totalInvested: totalAuto,
      },
      default: {
        totalProfitLoss: totals.auto.profitLoss + totals.brokerage.profitLoss,
        totalInvested: totalBrokerage + totalAuto,
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
