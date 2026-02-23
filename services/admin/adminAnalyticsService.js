const Trade = require("../../models/Trade");
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const { CustomError } = require("../../utils/utils");

async function fetchRecentUsers() {
  try {
    return await User.find().sort({ createdAt: -1 }).limit(6).lean();
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function fetchRecentActivities() {
  try {
    const [transactions, trades] = await Promise.all([
      Transaction.find().sort({ createdAt: -1 }).limit(3).lean(),
      Trade.find().sort({ createdAt: -1 }).limit(3).lean(),
    ]);

    return [...transactions, ...trades].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function fetchRecentTransactions() {
  try {
    return await Transaction.find().sort({ createdAt: -1 }).limit(6).lean();
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function fetchSystemAnalytics() {
  try {
    const [transactionAgg, tradeAgg, usersCount] = await Promise.all([
      Transaction.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),
      Trade.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$execution.amount" },
          },
        },
      ]),
      User.countDocuments(),
    ]);

    return {
      users: usersCount,
      trades: tradeAgg[0]?.total || 0,
      transactions: transactionAgg[0]?.total || 0,
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

module.exports = {
  fetchRecentActivities,
  fetchRecentTransactions,
  fetchRecentUsers,
  fetchSystemAnalytics,
};
