const Position = require("../../models/Position");
const Trade = require("../../models/Trade");
const Wallet = require("../../models/Wallet");
const positionService = require("./positionService");

/**
 * Sync all trades to positions (useful for backfilling data)
 */
async function syncTradesToPositions(userId) {
  const trades = await Trade.find({
    userId,
    status: "open",
  }).sort({ createdAt: 1 });

  const positionMap = new Map();

  for (const trade of trades) {
    const key = `${trade.userId}_${trade.asset.assetId}_${trade.wallet.id}`;

    if (!positionMap.has(key)) {
      const position = await positionService.updatePosition(trade);
      positionMap.set(key, position);
    } else {
      const position = positionMap.get(key);
      position.amountInvested += trade.execution.amount;
      position.performance.currentValue += trade.execution.positionAmount;
      position.performance.totalReturn =
        position.performance.currentValue - position.amountInvested;
      position.performance.totalReturnPercent =
        (position.performance.totalReturn / position.amountInvested) * 100;
      await position.save();
    }
  }

  return positionMap;
}

/**
 * Get user's complete portfolio including trades and positions
 */
async function getUserPortfolio(userId) {
  const [trades, positions, wallet] = await Promise.all([
    Trade.find({ userId, status: "open" }).sort({ createdAt: -1 }),
    Position.find({ userId, status: "open" }),
    Wallet.findOne({ userId, isDefault: true }),
  ]);

  return {
    summary: {
      totalInvested: positions.reduce((sum, p) => sum + p.amountInvested, 0),
      totalCurrentValue: positions.reduce(
        (sum, p) => sum + p.performance.currentValue,
        0,
      ),
      totalReturn: positions.reduce(
        (sum, p) => sum + p.performance.totalReturn,
        0,
      ),
      availableBalance: wallet?.availableBalance || 0,
      totalBalance: wallet?.totalBalance || 0,
    },
    positions,
    trades,
    wallet,
  };
}
