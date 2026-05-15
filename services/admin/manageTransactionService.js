const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const { fetchTransactionInfo } = require("../user/transactionService");

const portfolioService = require("../user/portfolioService");
const { default: mongoose } = require("mongoose");

async function fetchAllTransactions(queryData) {
  const {
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 15,
    filterBy,
  } = queryData;
  try {
    const filter = {};

    if (filterBy && typeof filterBy === "object") {
      Object.assign(filter, filterBy);
    }

    const sort = {};
    if (sortBy) sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const transactions = await Transaction.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const totalTrnxs = await Transaction.countDocuments(filter);
    const totalPages =
      Math.ceil(totalTrnxs / limit) === 0 ? 1 : Math.ceil(totalTrnxs / limit);

    return { transactions, totalTrnxs, totalPages, currentPage: page };
  } catch (error) {
    console.log(error);
    throw new CustomError(error.message, 500);
  }
}

async function editTransaction(transactionId, action) {
  if (!transactionId || !action) {
    throw new CustomError(
      "Bad request! Transaction ID and action are required.",
      400,
    );
  }

  if (!["approve", "reject"].includes(action)) {
    throw new CustomError(
      "Invalid action! Must be 'approve' or 'reject'.",
      400,
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const transaction =
      await Transaction.findById(transactionId).session(session);
    if (!transaction) {
      throw new CustomError("Transaction not found!", 404);
    }

    if (transaction.status === "processed") {
      throw new CustomError("Transaction already processed!", 400);
    }

    if (transaction.status === "failed") {
      throw new CustomError("Transaction already failed/rejected!", 400);
    }

    const transactionWallet = await Wallet.findOne({
      userId: transaction.userId,
      name: transaction.account,
    }).session(session);

    if (!transactionWallet) {
      throw new CustomError("Associated wallet not found!", 404);
    }

    if (action === "approve") {
      if (
        transaction.type === "withdrawal" &&
        transactionWallet.balance.available < transaction.amount
      ) {
        throw new CustomError(
          "Insufficient funds in wallet to approve withdrawal!",
          400,
        );
      }

      if (transaction.type === "deposit") {
        transactionWallet.balance.available += transaction.amount;
        transactionWallet.balance.total += transaction.amount;
      } else if (transaction.type === "withdrawal") {
        transactionWallet.balance.available -= transaction.amount;
        transactionWallet.balance.total -= transaction.amount;
      }

      await transactionWallet.save({ session });

      transaction.status = "processed";
      await transaction.save({ session });

      try {
        if (transaction.type === "deposit") {
          await portfolioService.updatePortfolioValue(
            transaction.userId,
            transaction.amount,
            "deposit",
            {
              transactionId: transaction._id,
              paymentMethod: transaction.method.mode,
            },
          );
        } else if (transaction.type === "withdrawal") {
          await portfolioService.updatePortfolioValue(
            transaction.userId,
            transaction.amount,
            "withdrawal",
            {
              transactionId: transaction._id,
              paymentMethod: transaction.method.mode,
            },
          );

          await PortfolioTracker.updatePortfolioValue(
            transaction.userId,
            -transaction.amount,
            {
              transactionId: transaction._id,
            },
            session,
          );
        }
      } catch (trackerError) {
        console.error("Portfolio service error:", trackerError.message);
      }
    } else if (action === "reject") {
      transaction.status = "failed";
      await transaction.save({ session });
    }

    await session.commitTransaction();
    return transaction;
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(
      error.message || "Failed to process transaction action!",
      500,
    );
  } finally {
    session.endSession();
  }
}

async function getTransactionInfo(transactionId) {
  try {
    const transaction = await fetchTransactionInfo(transactionId);
    return transaction;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function updateTransactionStatus({ formData }) {
  const { transactionId, status } = formData;

  if (!transactionId || !status) throw new CustomError("Bad request!", 400);
  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new CustomError("Transaction not found!", 404);
    }
    transaction.status = status;
    await transaction.save();
    return transaction;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function createTransaction(transactionData) {
  const { method, amount, accountId, memo, network, userId, type } =
    transactionData;

  // Validation
  if (!amount || !method || !accountId || !userId || !type) {
    throw new CustomError("Missing required fields!", 400);
  }

  if (!["deposit", "withdrawal"].includes(type)) {
    throw new CustomError("Invalid transaction type!", 400);
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    const wallets = await Wallet.find({ userId }).session(session);
    if (wallets.length === 0) {
      throw new CustomError("No wallets found for this user!", 404);
    }

    const receiver = wallets.find(
      (wallet) => wallet._id.toString() === accountId,
    );
    if (!receiver) {
      throw new CustomError("Invalid wallet!", 400);
    }

    if (
      type === "withdrawal" &&
      receiver.balance.available < parseFloat(amount)
    ) {
      throw new CustomError("Insufficient funds!", 400);
    }

    const customMemo = `${method} ${type} to ${receiver.name}`;

    const trnx = await Transaction.create(
      [
        {
          method: {
            mode: method,
            network: network || null,
          },
          amount: parseFloat(amount),
          account: receiver.name,
          memo: memo || customMemo,
          type: type,
          userId: userId,
          email: user.contactInfo.email,
          fullname: user.fullName,
          status: "processed",
        },
      ],
      { session },
    );

    const transaction = trnx[0];

    if (type === "deposit") {
      receiver.balance.total += parseFloat(amount);
      receiver.balance.available += parseFloat(amount);
    } else {
      receiver.balance.total -= parseFloat(amount);
      receiver.balance.available -= parseFloat(amount);
    }

    await receiver.save({ session });

    if (type === "deposit") {
      await portfolioService.updatePortfolioValue(
        transaction.userId,
        parseFloat(amount),
        "deposit",
        {
          transactionId: transaction._id,
          paymentMethod: transaction.method.mode,
        },
      );
    } else if (type === "withdrawal") {
      await portfolioService.updatePortfolioValue(
        transaction.userId,
        parseFloat(transaction.amount),
        "withdrawal",
        {
          transactionId: transaction._id,
          paymentMethod: transaction.method.mode,
        },
      );

      await PortfolioTracker.updatePortfolioValue(
        transaction.userId,
        -parseFloat(transaction.amount),
        {
          transactionId: transaction._id,
        },
      );
    }

    await session.commitTransaction();

    return transaction;
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message || "Transaction failed!", 500);
  } finally {
    session.endSession();
  }
}

module.exports = {
  getTransactionInfo,
  editTransaction,
  fetchAllTransactions,
  createTransaction,
  updateTransactionStatus,
};
