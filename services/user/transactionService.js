const { default: mongoose } = require("mongoose");
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const walletSnapshotService = require("./walletSnapshotService");

async function addFunds(userId, trnxData) {
  const { method, amount, memo, network, proof } = trnxData;
  if (!amount || !method || !network)
    throw new CustomError("Bad request!", 400);
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new CustomError("Contact support for more info!", 404);
    }

    const wallets = await Wallet.find({ userId });
    if (wallets.length < 1) {
      throw new CustomError("Contact support for more info!", 404);
    }

    const receiver = wallets.find((wallet) => wallet.slug === "cash");
    if (!receiver) {
      throw new CustomError("Invalid receiving account!", 400);
    }
    const customMemo = `${method} deposit to ${receiver.name}`;

    const meta = {
      type: "cash deposit",
      to: receiver.name,
      method: method,
      network: network,
    };

    const trnx = await Transaction.create({
      method: {
        mode: method,
        network: network,
      },
      amount: amount,
      account: receiver.name,
      memo: memo || customMemo,
      type: "deposit",
      userId: userId,
      email: user.contactInfo.email,
      fullname: user.fullName,
      proof: proof || null,
      meta: meta,
    });

    return { transaction: trnx, success: true };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function withdrawFunds(userId, trnxData) {
  const {
    method,
    amount,
    account,
    memo,
    network,
    address,
    bankName,
    accountNumber,
    routing,
  } = trnxData;
  if (!amount || !method || !account || !network)
    throw new CustomError("Bad request!", 400);
  try {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("Invalid credentials!", 404);

    if (user.identityVerification.kycStatus !== "approved")
      throw new CustomError("Account not verified!", 400);

    const wallets = await Wallet.find({ userId });
    if (wallets.length < 1) {
      throw new CustomError("Contact support for more info!", {
        statusCode: 404,
      });
    }

    const withdrawFrom = wallets.find((wallet) => wallet.slug === "cash");
    if (!withdrawFrom)
      throw new CustomError("Invalid withdrawal account!", 400);

    if (withdrawFrom.balance.available < parseFloat(amount))
      throw new CustomError("Insufficient funds!", 400);

    const customMemo = `${method} withdrawal from ${withdrawFrom.name}`;

    const bankInfo = `${`${bankName}-acc:${accountNumber}-rou:${routing}`}`;

    const meta = {
      type: "withdraw",
      to: withdrawFrom.name,
      method: method,
      network: network,
      info: method === "bank" ? bankInfo : address,
    };

    const trnx = await Transaction.create({
      method: {
        mode: method,
        network: network,
      },
      amount: amount,
      account: account,
      memo: memo || customMemo,
      type: "withdraw",
      userId: userId,
      email: user.contactInfo.email,
      fullname: user.fullName,
      meta: meta,
    });
    return trnx;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function moveFunds(userId, trnxData) {
  const { fromWallet, amount, toWallet, memo } = trnxData;

  if (!amount || !fromWallet || !toWallet) {
    throw new CustomError("Bad request!", 400);
  }

  if (fromWallet.toString() === toWallet.toString()) {
    throw new CustomError("Cannot transfer to the same account!", 400);
  }

  const parsedAmount = Number(amount);

  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new CustomError("Invalid amount!", 400);
  }

  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const [user, transferFrom, transferTo] = await Promise.all([
      User.findById(userId).session(session),

      Wallet.findOne({
        _id: fromWallet,
        userId,
      }).session(session),

      Wallet.findOne({
        _id: toWallet,
        userId,
      }).session(session),
    ]);

    if (!user) {
      throw new CustomError("Invalid credentials!", 404);
    }

    if (!transferFrom) {
      throw new CustomError("Invalid source account!", 400);
    }

    if (!transferTo) {
      throw new CustomError("Invalid receiving account!", 400);
    }

    if (transferFrom.balance.available < parsedAmount) {
      throw new CustomError("Insufficient funds!", 400);
    }

    transferFrom.balance.total -= parsedAmount;
    transferFrom.balance.available -= parsedAmount;

    transferTo.balance.total += parsedAmount;
    transferTo.balance.available += parsedAmount;

    await Promise.all([
      transferFrom.save({ session }),
      transferTo.save({ session }),
    ]);

    const customMemo = `Transfer from ${transferFrom.name} to ${transferTo.name}`;

    const transaction = await Transaction.create(
      [
        {
          method: {
            mode: transferFrom.name,
            network: "transfer",
          },
          amount: parsedAmount,
          account: transferTo.name,
          memo: memo || customMemo,
          type: "transfer",
          userId,
          email: user.contactInfo.email,
          fullname: user.fullName,
          status: "processed",
          meta: {
            type: "transfer",
            fromWalletId: transferFrom._id,
            toWalletId: transferTo._id,
            from: transferFrom.name,
            to: transferTo.name,
            method: "internal",
            network: "internal",
          },
        },
      ],
      { session },
    );

    const trnx = transaction[0];

    await Promise.all([
      walletSnapshotService.createWalletSnapshot(
        transferFrom._id,
        "transfer_out",
        {
          transactionId: trnx._id,
          amount: parsedAmount,
          toWalletId: transferTo._id,
          toWalletName: transferTo.name,
        },
        session,
      ),

      walletSnapshotService.createWalletSnapshot(
        transferTo._id,
        "transfer_in",
        {
          transactionId: trnx._id,
          amount: parsedAmount,
          fromWalletId: transferFrom._id,
          fromWalletName: transferFrom.name,
        },
        session,
      ),
    ]);

    await session.commitTransaction();

    return trnx;
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message || "Transfer failed!", 500);
  } finally {
    await session.endSession();
  }
}

async function getUserLedger(userId) {
  try {
    const transactions = await Transaction.find({ userId }).lean();

    const filteredTrans = transactions.filter((trx) => trx.type !== "savings");
    return transactions;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function cancelTransaction(transactionId) {
  try {
    const transaction = await Transaction.findOne({ _id: transactionId });

    if (transaction.status !== "pending") {
      throw new CustomError("Cannot cancel transaction!", 400);
    }

    transaction.status = "cancelled";
    await transaction.save();
    return transaction;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function getUserTrnxAnalytics(userId) {
  try {
    const transactions = await Transaction.find({ userId });

    let totalDeposit = 0;
    let totalWithdrawal = 0;
    let pendingDeposit = 0;
    let pendingWithdrawal = 0;
    let monthlyDeposit = 0;
    let monthlyWithdrawal = 0;

    const now = new Date();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    transactions.forEach((trnx) => {
      const amount = trnx.amount;
      const type = trnx.type;
      const status = trnx.status;
      const createdAt = new Date(trnx.createdAt);

      // Total completed deposits/withdrawals
      if (type === "deposit" && status === "processed") {
        totalDeposit += amount;
      }
      if (type === "withdraw" && status === "processed") {
        totalWithdrawal += amount;
      }

      // Pending transactions
      if (type === "deposit" && status === "pending") {
        pendingDeposit += amount;
      }
      if (type === "withdraw" && status === "pending") {
        pendingWithdrawal += amount;
      }

      // Monthly completed transaction
      if (
        status === "processed" &&
        createdAt >= monthStart &&
        createdAt <= monthEnd
      ) {
        if (type === "deposit") {
          monthlyDeposit += amount;
        } else if (type === "withdraw") {
          monthlyWithdrawal += amount;
        }
      }
    });

    return {
      totalDeposit,
      totalWithdrawal,
      pendingDeposit,
      pendingWithdrawal,
      monthlyDeposit,
      monthlyWithdrawal,
      netBalance: totalDeposit - totalWithdrawal,
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

async function fetchTransactionInfo(transactionId) {
  if (!transactionId) throw new CustomError("Transaction ID required!", 400);
  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw new CustomError("Transaction not found!", 404);

    return transaction;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, error.statusCode);
  }
}

module.exports = {
  cancelTransaction,
  getUserLedger,
  addFunds,
  withdrawFunds,
  moveFunds,
  getUserTrnxAnalytics,
  fetchTransactionInfo,
};
