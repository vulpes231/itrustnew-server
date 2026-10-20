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

    // Cash held in wallets (not including position value).
    const totalCashValue = wallets.reduce(
      (sum, wallet) => sum + (Number(wallet.balance?.total) || 0),
      0,
    );

    // Current market value of open positions, including bonus.
    const totalPositionValue = positions.reduce(
      (sum, position) =>
        sum + (Number(position.performance?.currentValue) || 0),
      0,
    );

    const savingsAccountValue = savingsAccts.reduce(
      (sum, account) => sum + (Number(account.balance?.total) || 0),
      0,
    );

    // Gross portfolio value before subtracting any outstanding margin debt.
    const currentNetWorth =
      totalCashValue + totalPositionValue + savingsAccountValue;

    const snapshotTimestamp = metadata.timestamp || new Date();

    const [snapshot] = await PortfolioSnapshot.create(
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

    return snapshot;
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
