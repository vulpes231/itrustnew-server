const PortfolioSnapshot = require("../../models/Portfolio");

class PortfolioService {
  async createAccountSnapshot(userId) {
    const snapshot = new PortfolioSnapshot({
      userId: userId,
      timestamp: new Date(),
      currentNetWorth: 0,
      reason: "account_creation",
    });
    await snapshot.save();
    return snapshot;
  }

  async updatePortfolioValue(
    userId,
    changeAmount,
    reason,
    wallet,
    metadata = {},
  ) {
    const current = await this.getCurrentPortfolioValue(userId);
    const newValue =
      reason === "trade_buy"
        ? current.currentNetWorth
        : current.currentNetWorth + changeAmount;

    const snapshot = new PortfolioSnapshot({
      userId: userId,
      timestamp: new Date(),
      currentNetWorth: newValue,
      reason: reason,
      wallet: {
        id: wallet?.id || null,
        name: wallet?.name || null,
      },
      metadata: metadata,
    });

    await snapshot.save();
    return snapshot;
  }

  async getCurrentPortfolioValue(userId) {
    const latest = await PortfolioSnapshot.findOne({ userId }).sort({
      timestamp: -1,
    });

    if (!latest) {
      return { currentNetWorth: 0 };
    }

    return {
      currentNetWorth: latest.currentNetWorth,
    };
  }

  async getChartData(userId, timeframe) {
    return await PortfolioSnapshot.getTimeframeData(userId, timeframe);
  }
}

module.exports = new PortfolioService();

// async recordDeposit(userId, amount, transactionId) {
//   const currentPortfolio = await this.getCurrentPortfolioValue(userId);
//   const newValue = currentPortfolio.currentNetWorth + amount;

//   const snapshot = new PortfolioSnapshot({
//     userId: userId,
//     timestamp: new Date(),
//     currentNetWorth: newValue,
//     reason: "deposit",
//     metadata: { transactionId },
//   });
//   await snapshot.save();
//   return snapshot;
// }

// async recordTradeBuy(userId, amount, assetSymbol, transactionId) {
//   const currentPortfolio = await this.getCurrentPortfolioValue(userId);
//   const newValue = currentPortfolio.currentNetWorth;

//   const snapshot = new PortfolioSnapshot({
//     userId: userId,
//     timestamp: new Date(),
//     currentNetWorth: newValue,
//     reason: "trade_buy",
//     metadata: { transactionId, assetSymbol, tradeAmount: amount },
//   });
//   await snapshot.save();
//   return snapshot;
// }

// async recordTradeSell(userId, amount, assetSymbol, transactionId) {
//   const currentPortfolio = await this.getCurrentPortfolioValue(userId);
//   const newValue = currentPortfolio.currentNetWorth + amount;

//   const snapshot = new PortfolioSnapshot({
//     userId: userId,
//     timestamp: new Date(),
//     currentNetWorth: newValue,
//     reason: "trade_sell",
//     metadata: { transactionId, assetSymbol, tradeAmount: amount },
//   });
//   await snapshot.save();
//   return snapshot;
// }

// async recordProfitLoss(userId, pnlAmount, assetSymbol) {
//   const currentPortfolio = await this.getCurrentPortfolioValue(userId);
//   const newValue = currentPortfolio.currentNetWorth + pnlAmount;

//   const snapshot = new PortfolioSnapshot({
//     userId: userId,
//     timestamp: new Date(),
//     currentNetWorth: newValue,
//     reason: "profit_loss",
//     metadata: { assetSymbol, pnlAmount },
//   });
//   await snapshot.save();
//   return snapshot;
// }
