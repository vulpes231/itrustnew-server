const Position = require("../../models/Position");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const WalletSnapshot = require("../../models/WalletSnapshot");
const { getPositionValue } = require("../../utils/utils");

class WalletSnapshotService {
  async createWalletSnapshot(
    walletId,
    source = "manual_adjustment",
    metadata = {},
    session = null,
    userId,
  ) {
    let wallet;

    const user = await User.findById(userId).session(session).lean();

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    const savingsAccts = user.savingsAccounts || [];

    if (source === "cashout" || source === "contribution") {
      wallet = savingsAccts.find(
        (wallet) => wallet._id.toString() === walletId.toString(),
      );
    } else {
      wallet = await Wallet.findById(walletId).session(session).lean();
    }

    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }

    const positions = await Position.find({
      "wallet.id": wallet._id,
      status: "open",
    })
      .session(session)
      .lean();

    const cashValue = wallet.balance?.total || 0;

    const openTrades = positions.filter((trade) => trade.status === "open");

    const positionValue = openTrades.reduce(
      (sum, position) => sum + getPositionValue(position),
      0,
    );

    const totalInvested = positions.reduce(
      (sum, position) => sum + (position.amountInvested || 0),
      0,
    );

    const unrealizedPnL = positions.reduce(
      (sum, position) => sum + (position.performance?.totalReturn || 0),
      0,
    );

    const totalValue = cashValue + positionValue;

    const snapshot = await WalletSnapshot.create(
      [
        {
          userId: wallet.userId || userId,
          walletId: wallet._id,
          walletName: wallet.name,
          cashValue,
          positionValue,
          totalValue,
          totalInvested,
          unrealizedPnL,
          source,
          metadata,
          snapshotAt: new Date(),
        },
      ],
      { session },
    );

    return snapshot[0];
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

  async getAccountSnapshot(userId, walletId, timeframe = "all") {
    const startDate = this.getStartDate(timeframe);

    const query = {
      userId,
      walletId,
    };

    if (startDate) {
      query.snapshotAt = {
        $gte: startDate,
      };
    }

    const snapshots = await WalletSnapshot.find(query)
      .sort({ snapshotAt: 1 })
      .lean();

    return snapshots.map((snapshot) => ({
      x: snapshot.snapshotAt,
      y: snapshot.totalValue,
      reason: snapshot.source,
    }));
  }

  async getAllSnapshot(userId, timeframe = "all") {
    const startDate = this.getStartDate(timeframe);

    const query = {
      userId,
    };

    if (startDate) {
      query.snapshotAt = {
        $gte: startDate,
      };
    }

    const cashAccount = await Wallet.findOne({ userId, slug: "cash" });

    const allSnapshots = await WalletSnapshot.find(query)
      .sort({ snapshotAt: 1 })
      .lean();

    const snapshots = allSnapshots.filter(
      (snap) => snap.walletId.toString() !== cashAccount._id.toString(),
    );

    return snapshots.map((snapshot) => ({
      x: snapshot.snapshotAt,
      y: snapshot.totalValue,
      reason: snapshot.source,
    }));
  }
}

module.exports = new WalletSnapshotService();
