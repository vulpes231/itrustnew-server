const Chart = require("../../models/Chart");

class PortfolioTracker {
  constructor() {
    console.log("PortfolioTracker initialized");
  }

  async initializeUser(userId) {
    try {
      await Chart.create({
        userId,
        timeline: [
          {
            timestamp: new Date(),
            balance: 0,
            eventType: "signup",
            note: "Account created",
          },
        ],
        currentBalance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalPnl: 0,
        firstActivity: new Date(),
        lastActivity: new Date(),
      });
      console.log(`Chart initialized for user ${userId}`);
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  async recordDeposit(userId, amount) {
    const chart = await Chart.findOne({ userId });
    if (!chart) {
      await this.initializeUser(userId);
      return this.recordDeposit(userId, amount);
    }

    const newBalance = chart.currentBalance + amount;

    await Chart.updateOne(
      { userId },
      {
        $push: {
          timeline: {
            timestamp: new Date(),
            balance: newBalance,
            eventType: "deposit",
            amount: amount,
            note: `Deposit of $${amount}`,
          },
        },
        $inc: {
          currentBalance: amount,
          totalDeposits: amount,
        },
        $set: { lastActivity: new Date() },
      }
    );

    console.log(`Deposit recorded for ${userId}: +$${amount}`);
  }

  async recordWithdrawal(userId, amount) {
    const chart = await Chart.findOne({ userId });
    if (!chart) {
      await this.initializeUser(userId);
      return this.recordWithdrawal(userId, amount);
    }

    const newBalance = chart.currentBalance - amount;

    await Chart.updateOne(
      { userId },
      {
        $push: {
          timeline: {
            timestamp: new Date(),
            balance: newBalance,
            eventType: "withdrawal",
            amount: -amount,
            note: `Withdrawal of $${amount}`,
          },
        },
        $inc: {
          currentBalance: -amount,
          totalWithdrawals: amount,
        },
        $set: { lastActivity: new Date() },
      }
    );

    console.log(`Withdrawal recorded for ${userId}: -$${amount}`);
  }

  async recordTrade(userId, pnl, description = "Trade executed") {
    const chart = await Chart.findOne({ userId });
    if (!chart) {
      await this.initializeUser(userId);
      return this.recordTrade(userId, pnl, description);
    }

    const newBalance = chart.currentBalance + pnl;

    await Chart.updateOne(
      { userId },
      {
        $push: {
          timeline: {
            timestamp: new Date(),
            balance: newBalance,
            eventType: "trade",
            pnl: pnl,
            note: description,
          },
        },
        $inc: {
          currentBalance: pnl,
          totalPnl: pnl,
        },
        $set: { lastActivity: new Date() },
      }
    );

    console.log(
      `Trade recorded for ${userId}: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`
    );
  }

  async recordSnapshot(userId) {
    const chart = await Chart.findOne({ userId });
    if (!chart) return;

    await Chart.updateOne(
      { userId },
      {
        $push: {
          timeline: {
            timestamp: new Date(),
            balance: chart.currentBalance,
            eventType: "snapshot",
            note: "Hourly balance snapshot",
          },
        },
      }
    );
  }

  async getUserChartData(userId, timeframe = "daily", limit = 30) {
    const chart = await Chart.findOne({ userId });
    if (!chart) return { data: [], stats: null };

    const timeline = chart.getChartData(timeframe, limit);

    const stats = {
      currentBalance: chart.currentBalance,
      totalDeposits: chart.totalDeposits,
      totalWithdrawals: chart.totalWithdrawals,
      totalPnl: chart.totalPnl,
      netProfit: chart.totalPnl - chart.totalWithdrawals,
      returnPercentage:
        chart.totalDeposits > 0
          ? (
              ((chart.currentBalance - chart.totalDeposits) /
                chart.totalDeposits) *
              100
            ).toFixed(2)
          : 0,
    };

    return { data: timeline, stats };
  }
}

module.exports = new PortfolioTracker();
