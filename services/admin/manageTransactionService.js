const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const { fetchTransactionInfo } = require("../user/transactionService");
const { default: mongoose } = require("mongoose");
const walletSnapshotService = require("../user/walletSnapshotService");
const portfolioService = require("../user/portfolioService");

async function fetchAllTransactions(queryData) {
  const {
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 1000,
    filterBy,
  } = queryData;
  try {
    const filter = {};

    if (filterBy && typeof filterBy === "object") {
      Object.assign(filter, filterBy);
    }

    const sort = {};
    if (sortBy) sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // const transactions = await Transaction.find({}).sort({ createdAt: -1 });
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort(sort),

      Transaction.countDocuments(filter),
    ]);

    return {
      transactions,
      totalTrnxs: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    };
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

    const user = await User.findById(transaction.userId).session(session);
    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    if (transaction.status === "processed") {
      throw new CustomError("Transaction already processed!", 400);
    }

    if (transaction.status === "failed") {
      throw new CustomError("Transaction already failed/rejected!", 400);
    }

    const transactionWallet = await Wallet.findOne({
      userId: transaction.userId,
      slug: "cash",
    }).session(session);

    if (!transactionWallet) {
      throw new CustomError("Associated wallet not found!", 404);
    }

    if (action === "approve") {
      if (
        transaction.type === "withdraw" &&
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
      } else if (transaction.type === "withdraw") {
        transactionWallet.balance.available -= transaction.amount;
        transactionWallet.balance.total -= transaction.amount;
      }

      await transactionWallet.save({ session });

      transaction.status = "processed";
      await transaction.save({ session });

      try {
        if (transaction.type === "deposit") {
          await portfolioService.createPortfolioSnapshot(
            transaction.userId,
            "deposit",
            {
              transactionId: transaction._id,
            },
            session,
          );
          await walletSnapshotService.createWalletSnapshot(
            transactionWallet._id,
            "deposit",
            {
              transactionId: transaction._id,
            },
            session,
          );
        } else if (transaction.type === "withdraw") {
          await portfolioService.createPortfolioSnapshot(
            transaction.userId,
            "withdraw",
            {
              transactionId: transaction._id,
            },
            session,
          );
          await walletSnapshotService.createWalletSnapshot(
            transactionWallet._id,
            "withdraw",
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

    return {
      transaction,
      success: true,
      userInfo: {
        sendAlert: user.mailing.emailNotification,
        email: user.contactInfo.email,
        currency: user.currency,
      },
    };
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
  const {
    method,
    amount,
    accountId,
    memo,
    network,
    userId,
    type,
    customDate,
    toAccountId,
    address,
    bankName,
    accountNumber,
    routing,
    accountName,
  } = transactionData;

  if (!amount || !method || !accountId || !userId || !type) {
    throw new CustomError("Missing required fields!", 400);
  }

  if (!["deposit", "withdraw", "transfer"].includes(type)) {
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

    let transferToAccount;

    const receiver = wallets.find(
      (wallet) => wallet._id.toString() === accountId,
    );
    if (!receiver) {
      throw new CustomError("Invalid wallet!", 400);
    }

    if (type === "transfer") {
      if (!toAccountId) {
        throw new CustomError("Destination wallet is required.", 400);
      }

      transferToAccount = wallets.find(
        (wallet) => wallet._id.toString() === toAccountId,
      );

      if (!transferToAccount) {
        throw new CustomError("Destination wallet not found.", 404);
      }

      if (receiver._id.equals(transferToAccount._id)) {
        throw new CustomError("Cannot transfer to the same wallet.", 400);
      }
    }

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      throw new CustomError("Invalid amount.", 400);
    }

    if (
      ["withdraw", "transfer"].includes(type) &&
      receiver.balance.available < value
    ) {
      throw new CustomError("Insufficient funds!", 400);
    }

    const customMemo = `${method} ${type} to ${receiver.slug}`;

    const transactionPayload = {
      method: {
        mode: method,
        network: network || null,
      },
      amount: value,
      account: receiver.slug,
      memo: memo || customMemo,
      type,
      userId,
      email: user.contactInfo.email,
      fullname: user.fullName,
      status: "processed",
      ...(type === "transfer" && {
        meta: {
          type: "transfer",
          fromWalletId: receiver._id,
          toWalletId: transferToAccount._id,
          from: receiver.slug,
          to: transferToAccount.slug,
          method: "internal",
          network: "internal",
        },
      }),
    };

    let bankInfo;

    if (type === "withdraw") {
      bankInfo = `${`${bankName}-acc:${accountNumber}-rou:${routing}-owner:${accountName}`}`;
    }

    transactionPayload.meta = {
      type: "withdraw",
      to: receiver.name,
      method: method,
      network: network,
      info: method === "bank" ? bankInfo : address,
    };

    if (customDate) {
      const date = new Date(customDate);

      if (Number.isNaN(date.getTime())) {
        throw new CustomError("Invalid custom date.", 400);
      }

      transactionPayload.createdAt = date;
      transactionPayload.updatedAt = date;
    }

    const [transaction] = await Transaction.create([transactionPayload], {
      session,
      ...(customDate && { timestamps: false }),
    });

    if (type === "deposit") {
      receiver.balance.total += value;
      receiver.balance.available += value;
    } else if (type === "transfer") {
      receiver.balance.total -= value;
      receiver.balance.available -= value;
      transferToAccount.balance.total += value;
      transferToAccount.balance.available += value;
    } else {
      receiver.balance.total -= value;
      receiver.balance.available -= value;
    }

    await receiver.save({ session });

    if (transferToAccount) {
      await transferToAccount.save({ session });
    }

    if (type === "deposit") {
      await portfolioService.createPortfolioSnapshot(
        transaction.userId,
        "deposit",
        {
          transactionId: transaction._id,
          timestamp: transaction.createdAt,
        },
        session,
      );
      await walletSnapshotService.createWalletSnapshot(
        receiver._id,
        "deposit",
        {
          transactionId: transaction._id,
          timestamp: transaction.createdAt,
        },
        session,
      );
    } else if (type === "withdraw") {
      await portfolioService.createPortfolioSnapshot(
        transaction.userId,
        "withdraw",
        {
          transactionId: transaction._id,
          timestamp: transaction.createdAt,
        },
        session,
      );
      await walletSnapshotService.createWalletSnapshot(
        receiver._id,
        "withdraw",
        {
          transactionId: transaction._id,
          timestamp: transaction.createdAt,
        },
        session,
      );
    } else {
      await walletSnapshotService.createWalletSnapshot(
        receiver._id,
        "transfer_out",
        {
          transactionId: transaction._id,
          timestamp: transaction.createdAt,
        },
        session,
      );

      await walletSnapshotService.createWalletSnapshot(
        transferToAccount._id,
        "transfer_in",
        {
          transactionId: transaction._id,
          timestamp: transaction.createdAt,
        },
        session,
      );
    }

    await session.commitTransaction();

    return { transaction, success: true, email: user.contactInfo.email };
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

async function editTransactionInfo(transactionData) {
  const { amount, customDate, transactionId } = transactionData;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const transaction =
      await Transaction.findById(transactionId).session(session);

    if (!transaction) {
      throw new CustomError("Transaction not found.", 404);
    }

    const wallet = await Wallet.findOne({
      userId: transaction.userId,
      slug: transaction.account,
    }).session(session);

    if (!wallet) {
      throw new CustomError("Wallet not found.", 404);
    }

    const parsedAmount = Number(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new CustomError("Invalid amount.", 400);
    }

    const oldAmount = transaction.amount;
    const difference = parsedAmount - oldAmount;

    if (transaction.type === "deposit") {
      wallet.balance.total += difference;
      wallet.balance.available += difference;
    } else {
      if (wallet.balance.available < difference) {
        throw new CustomError("Insufficient wallet balance.", 400);
      }

      wallet.balance.total -= difference;
      wallet.balance.available -= difference;
    }

    transaction.amount = parsedAmount;

    if (customDate) {
      const date = new Date(customDate);

      if (Number.isNaN(date.getTime())) {
        throw new CustomError("Invalid custom date.", 400);
      }

      transaction.createdAt = date;
      // transaction.updatedAt = date;
    }

    await wallet.save({ session });
    await transaction.save({ session });

    await session.commitTransaction();

    return transaction;
  } catch (error) {
    await session.abortTransaction();
    throw error instanceof CustomError
      ? error
      : new CustomError(error.message, 500);
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
  editTransactionInfo,
};
