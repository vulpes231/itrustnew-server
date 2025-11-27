const Trade = require("../../models/Trade");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");

const tradeService = require("../user/tradeService");

async function fetchUserWallets(userId) {
  try {
    const wallets = await Wallet.find({ userId: userId }).lean();
    return wallets;
  } catch (error) {
    throw new CustomError("Failed to fetch user wallets!", 500);
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
        dailyProfit: 0,
        dailyProfitPercent: 0,
        totalProfitPercent: 0,
        totalInvested: 0,
        totalProfit: 0,
      };
    }

    const totalBalance = wallets.reduce(
      (sum, wallet) => sum + (wallet.totalBalance || 0),
      0
    );
    const availableBalnce = wallets.reduce(
      (sum, wallet) => sum + (wallet.availableBalance || 0),
      0
    );

    const dailyProfit = wallets.reduce(
      (sum, wallet) => sum + (wallet.dailyProfit || 0),
      0
    );

    const dailyProfitPercent =
      totalBalance > 0 ? (dailyProfit / totalBalance) * 100 : 0;

    const totalInvested = userTrades.reduce(
      (sum, trade) => sum + (trade.execution?.amount || 0),
      0
    );

    const totalProfit = userTrades.reduce(
      (sum, trade) => sum + (trade.performance?.totalReturn || 0),
      0
    );

    const totalProfitPercent =
      totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    return {
      totalBalance,
      dailyProfit,
      dailyProfitPercent: Number(dailyProfitPercent.toFixed(2)),
      totalProfitPercent: Number(totalProfitPercent.toFixed(2)),
      totalInvested,
      totalProfit,
      availableBalnce,
    };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, error.statusCode);
  }
}

module.exports = { fetchUserWallets, getUserFinancialSummary };

// totalInvested, totalProfit, totalProfitPercent,
