const Position = require("../../models/Position");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const WalletSnapshot = require("../../models/WalletSnapshot");
const { getPositionValue } = require("../../utils/utils");
const { fetchPortfolioAccounts } = require("./walletService");

class WalletSnapshotService {
  async createWalletSnapshot(
    walletId,
    source = "manual_adjustment",
    metadata = {},
    session = null,
    userId = null,
  ) {
    let wallet;

    if (source === "cashout" || source === "contribution") {
      const user = await User.findById(userId).session(session).lean();

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      const savingsAccts = user.savingsAccounts || [];
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

    console.log(wallet, "WalletSnapshot");

    const positionValue = positions.reduce(
      (sum, position) => sum + getPositionValue(position),
      0,
    );
    console.log(positionValue, "WalletSnapshot");

    const totalInvested = positions.reduce(
      (sum, position) => sum + (position.amountInvested || 0),
      0,
    );

    const unrealizedPnL = positions.reduce(
      (sum, position) => sum + (position.performance?.totalReturn || 0),
      0,
    );

    const totalValue = cashValue + positionValue;
    const finalUserId = wallet.userId || userId;
    if (!finalUserId) {
      throw new Error(`Could not determine userId for wallet ${walletId}`);
    }

    const snapshot = await WalletSnapshot.create(
      [
        {
          userId: finalUserId,
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

  async getCombinedWalletSnapshots(userId, timeframe = "all") {
    if (!userId) {
      throw new Error("userId is required");
    }

    const AllAccounts = await fetchPortfolioAccounts(userId);

    const tradingAccounts = AllAccounts.filter(
      (acct) => acct._id !== "default",
    );

    const walletIdArray = tradingAccounts
      .map((acct) => acct._id.toString())
      .filter(Boolean);

    if (walletIdArray.length === 0) {
      return [];
    }

    const startDate = this.getStartDate(timeframe);

    const query = {
      userId,
      walletId: { $in: walletIdArray },
    };

    if (startDate) {
      query.snapshotAt = { $gte: startDate };
    }

    const allSnapshots = await WalletSnapshot.find(query)
      .sort({ snapshotAt: 1 })
      .lean();

    if (allSnapshots.length === 0) return [];

    console.log(allSnapshots.length);

    const walletData = new Map();

    for (const snap of allSnapshots) {
      const wid = snap.walletId.toString();
      if (!walletData.has(wid)) walletData.set(wid, []);

      walletData.get(wid).push({
        x: new Date(snap.snapshotAt),
        y: Number(snap.totalValue || 0),
      });
    }

    // const grouped = {};

    // for (const s of allSnapshots) {
    //   const wid = s.walletId.toString();
    //   grouped[wid] = (grouped[wid] || 0) + 1;
    // }

    // console.log(grouped);

    const allTimestamps = [
      ...new Set(allSnapshots.map((s) => s.snapshotAt.getTime())),
    ].sort((a, b) => a - b);

    const combined = [];
    const lastValues = new Map();

    for (const ts of allTimestamps) {
      const currentTime = new Date(ts);

      const snapsAtThisTime = allSnapshots.filter(
        (s) => s.snapshotAt.getTime() === ts,
      );

      for (const snap of snapsAtThisTime) {
        lastValues.set(snap.walletId.toString(), Number(snap.totalValue || 0));
      }

      let totalY = 0;
      for (const walletId of walletIdArray) {
        totalY += lastValues.get(walletId) || 0;
      }

      combined.push({
        x: currentTime,
        y: Number(totalY.toFixed(4)),
        reason: "combined",
      });
    }

    return combined;
  }
}

module.exports = new WalletSnapshotService();
