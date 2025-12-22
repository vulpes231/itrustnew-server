const { default: mongoose } = require("mongoose");
const SavingsAccount = require("../../models/Savingsaccount");
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");

async function fetchAvailableSavings() {
  try {
    const savingsAccounts = await SavingsAccount.find().lean();
    return savingsAccounts;
  } catch (error) {
    throw new CustomError("Failed to get savings accounts! Try again.", 500);
  }
}

async function addSavingsAccount(userId, accountId) {
  if (!userId || !accountId) throw new CustomError("Bad request!", 400);

  try {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("Invalid credentials!", 404);

    const acct = await SavingsAccount.findById(accountId);
    if (!acct) throw new CustomError("Account not found!", 404);

    const userCountryId = user.locationDetails.country.countryId;

    const canOpenAccount = acct.eligibleCountries.find(
      (countryId) => countryId === userCountryId
    );
    if (!canOpenAccount)
      throw new CustomError("Account not available in your location!", {
        statusCode: 400,
      });

    const acctExistsInUserSavings = user.savingsAccounts.find(
      (acct) => acct.accountId === acct._id
    );
    if (acctExistsInUserSavings)
      throw new CustomError("Account exist already!", 409);

    const newAccountData = {
      name: acct.name,
      accountId: acct._id,
      symbol: acct.symbol,
      title: acct.title,
      rate: acct.interestRate,
      canTrade: acct.canTrade,
      tag: acct.category,
      analytics: {
        totalReturn: 0,
        dailyChange: 0,
        balance: 0,
        contribution: 0,
        withdrawals: 0,
      },
    };

    user.savingsAccounts.push(newAccountData);
    await user.save();

    return newAccountData.name;
  } catch (error) {
    throw new CustomError("Failed to open savings account. Try again", 500);
  }
}

async function fetchUserSavingsAccount(userId) {
  if (!userId) throw new CustomError("Bad request", 400);
  try {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("Invalid credentials!", 404);

    const userSavingsAccount = user.savingsAccounts;
    return userSavingsAccount;
  } catch (error) {
    throw new CustomError(
      "Failed to get user savings accounts. Try again",
      500
    );
  }
}

async function fetchUserSavingsHistory(userId, queryData) {
  if (!userId) throw new CustomError("Bad request!", 400);
  const { page, limit, sortBy } = queryData;
  try {
    const sort = {};
    if (sortBy === "createdAt") sort["createdAt"] = -1;
    if (sortBy === "method") sort["method"] = -1;

    const savingsHistory = await Transaction.find({
      userId,
      type: "savings",
    })
      .sort(sort)
      .skip((page - 1) * limit);

    const totalItem = await Transaction.countDocuments({
      userId,
      type: "savings",
    });

    const totalPage = Math.ceil(totalItem / limit);
    const currentPage = page;
    return { savingsHistory, totalItem, totalPage, currentPage };
  } catch (error) {
    throw new CustomError("Failed to fetch user savings history", 500);
  }
}

async function fundSavings(userId, fundData) {
  const { amount, accountId, walletId, memo } = fundData;

  if (!amount || !accountId || !walletId) {
    throw new CustomError("Bad request!", 400);
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new CustomError("Invalid credentials!", 401);
    }

    const wallet = await Wallet.findOne({ _id: walletId, userId }).session(
      session
    );
    if (!wallet) {
      throw new CustomError("Invalid wallet selected!", 404);
    }

    const accountIndex = user.savingsAccounts.findIndex(
      (acct) => acct.accountId.toString() === accountId
    );

    if (accountIndex === -1) {
      throw new CustomError("Invalid savings account!", 404);
    }

    const account = user.savingsAccounts[accountIndex];
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new CustomError("Invalid amount!", 400);
    }

    if (wallet.availableBalance < parsedAmount) {
      throw new CustomError("Insufficient funds!", 400);
    }

    wallet.availableBalance -= parsedAmount;
    wallet.totalBalance -= parsedAmount;
    await wallet.save({ session });

    user.savingsAccounts[accountIndex].analytics.balance += parsedAmount;
    user.savingsAccounts[accountIndex].analytics.contributions += parsedAmount;

    await user.save({ session });

    await Transaction.create(
      [
        {
          method: {
            mode: "contribution",
            network: "credit",
          },
          type: "savings",
          userId: user._id,
          account: account.name,
          memo: memo || `Cash contribution to ${account.name}`,
          amount: parsedAmount,
          status: "completed",
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      message: "Savings account funded successfully",
      data: {
        newWalletBalance: wallet.availableBalance,
        newSavingsBalance: user.savingsAccounts[accountIndex].analytics.balance,
      },
    };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Error funding savings account:", error);
    throw new CustomError(error.message || "Transaction failed", 500);
  } finally {
    await session.endSession();
  }
}

async function withdrawSavings(userId, withdrawData) {
  const { amount, accountId, walletId, memo } = withdrawData;

  if (!amount || !accountId || !walletId) {
    throw new CustomError("Bad request!", 400);
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new CustomError("Invalid credentials!", 404);
    }

    const wallet = await Wallet.findOne({ _id: walletId, userId }).session(
      session
    );
    if (!wallet) {
      throw new CustomError("Invalid wallet selected!", 404);
    }

    const accountIndex = user.savingsAccounts.findIndex(
      (acct) => acct.accountId.toString() === accountId
    );

    if (accountIndex === -1) {
      throw new CustomError("Invalid savings account!", 404);
    }

    const account = user.savingsAccounts[accountIndex];
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new CustomError("Invalid amount!", 400);
    }

    if (account.analytics.balance < parsedAmount) {
      throw new CustomError("Insufficient funds!", 400);
    }

    user.savingsAccounts[accountIndex].analytics.balance -= parsedAmount;
    user.savingsAccounts[accountIndex].analytics.withdrawals += parsedAmount;

    await user.save({ session });

    wallet.availableBalance += parsedAmount;
    wallet.totalBalance += parsedAmount;

    await wallet.save({ session });

    await Transaction.create(
      [
        {
          method: {
            mode: "cashout",
            network: "debit",
          },
          type: "savings",
          userId: user._id,
          account: account.name,
          memo: memo || `Cash withdrawal from ${account.name}`,
          amount: parsedAmount,
          status: "completed",
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Withdrawal error:", error);
    throw new CustomError(error.message || "Transaction failed", 500);
  } finally {
    await session.endSession();
  }
}

// async function fetchSavingsAnalytics(userId) {
// 	if (!userId) throw new CustomError("Bad request", 400);
// 	try {
// 		const user = await User.findById(userId);
// 		if (!user) throw new CustomError("Invalid credentials!", 404);

// 		const userSavingsAccount = user.savingsAccounts;
// 		return userSavingsAccount;
// 	} catch (error) {
// 		throw new CustomError( "Failed to fetch savings analytics", 500);
// 	}
// }

module.exports = {
  fetchAvailableSavings,
  // fetchSavingsAnalytics,
  fetchUserSavingsAccount,
  fetchUserSavingsHistory,
  addSavingsAccount,
  fundSavings,
  withdrawSavings,
};
