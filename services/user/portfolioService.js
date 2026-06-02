const PortfolioSnapshot = require("../../models/Portfolio");

class PortfolioService {
  async createAccountSnapshot(userId) {
    const snapshot = new PortfolioSnapshot({
      userId: userId,
      timestamp: new Date(),
      portfolioValue: 0,
      cashBalance: 0,
      assetValue: 0,
      reason: "account_creation",
    });
    await snapshot.save();
    return snapshot;
  }

  async updatePortfolioValue(userId, changeAmount, reason, metadata = {}) {
    const current = await this.getCurrentPortfolioValue(userId);
    const newValue = current.portfolioValue + changeAmount;

    const snapshot = new PortfolioSnapshot({
      userId: userId,
      timestamp: new Date(),
      portfolioValue: newValue,
      cashBalance:
        current.cashBalance +
        (reason === "deposit"
          ? changeAmount
          : reason === "withdrawal"
            ? -changeAmount
            : reason === "trade_buy"
              ? -changeAmount
              : reason === "trade_sell"
                ? changeAmount
                : 0),
      assetValue:
        current.assetValue +
        (reason === "trade_buy"
          ? changeAmount
          : reason === "trade_sell"
            ? -changeAmount
            : reason === "profit_loss"
              ? changeAmount
              : 0),
      reason: reason,
      metadata: metadata,
    });

    await snapshot.save();
    return snapshot;
  }

  async recordDeposit(userId, amount, transactionId) {
    const currentPortfolio = await this.getCurrentPortfolioValue(userId);
    const newValue = currentPortfolio.portfolioValue + amount;

    const snapshot = new PortfolioSnapshot({
      userId: userId,
      timestamp: new Date(),
      portfolioValue: newValue,
      cashBalance: currentPortfolio.cashBalance + amount,
      assetValue: currentPortfolio.assetValue,
      reason: "deposit",
      metadata: { transactionId },
    });
    await snapshot.save();
    return snapshot;
  }

  async recordTradeBuy(userId, amount, assetSymbol, transactionId) {
    const currentPortfolio = await this.getCurrentPortfolioValue(userId);
    const newValue = currentPortfolio.portfolioValue - amount;

    const snapshot = new PortfolioSnapshot({
      userId: userId,
      timestamp: new Date(),
      portfolioValue: newValue,
      cashBalance: currentPortfolio.cashBalance - amount,
      assetValue: currentPortfolio.assetValue + amount,
      reason: "trade_buy",
      metadata: { transactionId, assetSymbol, tradeAmount: amount },
    });
    await snapshot.save();
    return snapshot;
  }

  async recordTradeSell(userId, amount, assetSymbol, transactionId) {
    const currentPortfolio = await this.getCurrentPortfolioValue(userId);
    const newValue = currentPortfolio.portfolioValue + amount;

    const snapshot = new PortfolioSnapshot({
      userId: userId,
      timestamp: new Date(),
      portfolioValue: newValue,
      cashBalance: currentPortfolio.cashBalance + amount,
      assetValue: currentPortfolio.assetValue - amount,
      reason: "trade_sell",
      metadata: { transactionId, assetSymbol, tradeAmount: amount },
    });
    await snapshot.save();
    return snapshot;
  }

  async recordProfitLoss(userId, pnlAmount, assetSymbol) {
    const currentPortfolio = await this.getCurrentPortfolioValue(userId);
    const newValue = currentPortfolio.portfolioValue + pnlAmount;

    const snapshot = new PortfolioSnapshot({
      userId: userId,
      timestamp: new Date(),
      portfolioValue: newValue,
      cashBalance: currentPortfolio.cashBalance,
      assetValue: currentPortfolio.assetValue + pnlAmount,
      reason: "profit_loss",
      metadata: { assetSymbol, pnlAmount },
    });
    await snapshot.save();
    return snapshot;
  }

  async getCurrentPortfolioValue(userId) {
    const latest = await PortfolioSnapshot.findOne({ userId }).sort({
      timestamp: -1,
    });

    if (!latest) {
      return { portfolioValue: 0, cashBalance: 0, assetValue: 0 };
    }

    return {
      portfolioValue: latest.portfolioValue,
      cashBalance: latest.cashBalance,
      assetValue: latest.assetValue,
    };
  }

  async getChartData(userId, timeframe) {
    return await PortfolioSnapshot.getTimeframeData(userId, timeframe);
  }
}

module.exports = new PortfolioService();
