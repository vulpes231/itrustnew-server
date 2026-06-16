const PortfolioSnapshot = require("../../models/Portfolio");
const Position = require("../../models/Position");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { getPositionValue } = require("../../utils/utils");

class PortfolioService {
  async createPortfolioSnapshot(userId, reason, metadata = {}, session = null) {
    const user = await User.findById(userId).session(session).lean();

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    const savingsAccts = user.savingsAccounts || [];

    const wallets = await Wallet.find({ userId }).session(session).lean();
    const positions = await Position.find({
      userId,
      status: "open",
    })
      .session(session)
      .lean();

    const totalCashValue = wallets.reduce(
      (sum, wallet) => sum + (wallet.balance?.total || 0),
      0,
    );

    const openTrades = positions.filter((trade) => trade.status === "open");

    const totalPositionValue = openTrades.reduce(
      (sum, position) => sum + getPositionValue(position),
      0,
    );

    const savingsAccountValue = savingsAccts.reduce(
      (sum, acct) => sum + (acct.balance.total || 0),
      0,
    );

    const currentNetWorth =
      totalCashValue + totalPositionValue + savingsAccountValue;

    const snapshotTimestamp = metadata.timestamp || new Date();

    const snap = await PortfolioSnapshot.create(
      [
        {
          userId,
          timestamp: snapshotTimestamp,
          currentNetWorth,
          reason,
          metadata,
        },
      ],
      { session },
    );

    return snap[0];
  }
  getStartDate(timeframe) {
    const now = new Date();

    switch (timeframe) {
      case "1h":
        return new Date(now.getTime() - 60 * 60 * 1000);

      case "1d":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);

      case "1w":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      case "1m":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      case "1y":
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      case "all":
        return null;

      default:
        throw new Error("Invalid timeframe");
    }
  }

  async getDashboardSnapshot(userId, timeframe = "all") {
    const startDate = this.getStartDate(timeframe);

    const query = { userId };

    if (startDate) {
      query.timestamp = {
        $gte: startDate,
      };
    }

    const snapshots = await PortfolioSnapshot.find(query)
      .sort({ timestamp: 1 })
      .select("timestamp currentNetWorth reason")
      .lean();

    return snapshots.map((snapshot) => ({
      x: snapshot.timestamp,
      y: snapshot.currentNetWorth,
      reason: snapshot.reason,
    }));
  }
}

module.exports = new PortfolioService();
