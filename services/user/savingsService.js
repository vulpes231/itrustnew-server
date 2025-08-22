const SavingsAccount = require("../../models/Savingsaccount");
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { throwError } = require("../../utils/utils");

async function fetchAvailableSavings() {
	try {
		const savingsAccounts = await SavingsAccount.find().lean();
		return savingsAccounts;
	} catch (error) {
		throwError(error, "Failed to get savings accounts. Try again", 500);
	}
}

async function addSavingsAccount(userId, accountId) {
	if (!userId || !accountId)
		throw new Error("Bad request!", { statusCode: 400 });

	try {
		const user = await User.findById(userId);
		if (!user) throw new Error("Invalid credentials!", { statusCode: 404 });

		const acct = await SavingsAccount.findById(accountId);
		if (!acct) throw new Error("Account not found!", { statusCode: 404 });

		const userCountryId = user.locationDetails.country.countryId;

		const canOpenAccount = acct.eligibleCountries.find(
			(countryId) => countryId === userCountryId
		);
		if (!canOpenAccount)
			throw new Error("Account not available in your location!", {
				statusCode: 400,
			});

		const acctExistsInUserSavings = user.savingsAccounts.find(
			(acct) => acct.accountId === acct._id
		);
		if (acctExistsInUserSavings)
			throw new Error("Account exist already!", { statusCode: 409 });

		const newAccountData = {
			name: acct.name,
			accountId: acct._id,
			analytics: {
				totalReturn: 0,
				dailyChange: 0,
				balance: 0,
			},
		};

		user.savingsAccounts.push(newAccountData);

		await user.save();
		return newAccountData.name;
	} catch (error) {
		throwError(error, "Failed to open savings account. Try again", 500);
	}
}

async function fetchUserSavingsAccount(userId) {
	if (!userId) throw new Error("Bad request", { statusCode: 400 });
	try {
		const user = await User.findById(userId);
		if (!user) throw new Error("Invalid credentials!", { statusCode: 404 });

		const userSavingsAccount = user.savingsAccounts;
		return userSavingsAccount;
	} catch (error) {
		throwError(error, "Failed to get user savings accounts. Try again", 500);
	}
}

async function fetchUserSavingsHistory(userId, queryData) {
	if (!userId) throw new Error("Bad request!", { statusCode: 400 });
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
		throwError(error, "Failed to fetch user savings history", 500);
	}
}

async function fundSavings(userId, fundData) {
	const { amount, accountId, walletName, memo } = fundData;
	if (!amount || !accountId || !walletName)
		throw new Error("Bad request!", { statusCode: 400 });
	try {
		const user = await User.findById(userId);
		if (!user) throw new Error("Invalid credentials!", { statusCode: 401 });

		const wallet = await Wallet.findOne({ userId, name: walletName });
		if (!wallet)
			throw new Error("Invalid wallet selected!", { statusCode: 404 });

		const account = user.savingsAccounts.find(
			(acct) => acct.accountId === accountId
		);
		if (!account)
			throw new Error("Invalid savings account!", { statusCode: 404 });

		const parsedAmount = parseFloat(amount);

		if (!wallet.availableBalance < parsedAmount)
			throw new Error("Insufficient funds!", { statusCode: 400 });

		wallet.availableBalance -= parsedAmount;
		await wallet.save();

		account.analytics.balance += parsedAmount;
		await account.save();

		await Transaction.create({
			method: {
				mode: "contribution",
				network: "credit",
			},
			type: "savings",
			userId: user._id,
			account: account.name,
			memo: memo || null,
			amount: parsedAmount,
			status: "completed",
		});
	} catch (error) {
		throwError(error, "Failed to fetch add funds to savings account", 500);
	}
}

async function withdrawSavings(userId, withdrawData) {
	const { amount, accountId, walletName, memo } = withdrawData;
	if (!amount || !accountId || !walletName)
		throw new Error("Bad request!", { statusCode: 400 });
	try {
		const user = await User.findById(userId);
		if (!user) throw new Error("Invalid credentials!", { statusCode: 401 });

		const wallet = await Wallet.findOne({ userId, name: walletName });
		if (!wallet)
			throw new Error("Invalid wallet selected!", { statusCode: 404 });

		const account = user.savingsAccounts.find(
			(acct) => acct.accountId === accountId
		);
		if (!account)
			throw new Error("Invalid savings account!", { statusCode: 404 });

		const parsedAmount = parseFloat(amount);

		if (account.analytics.balance < parsedAmount)
			throw new Error("Insufficient funds!", { statusCode: 400 });

		account.analytics.balance -= parsedAmount;
		await account.save();

		wallet.availableBalance += parsedAmount;
		wallet.totalBalance += parsedAmount;
		await wallet.save();

		await Transaction.create({
			method: {
				mode: "cashout",
				network: "debit",
			},
			type: "savings",
			userId: user._id,
			account: account.name,
			memo: memo || null,
			amount: parsedAmount,
			status: "completed",
		});
	} catch (error) {
		throwError(
			error,
			"Failed to fetch withdraw funds from savings account",
			500
		);
	}
}

// async function fetchSavingsAnalytics(userId) {
// 	if (!userId) throw new Error("Bad request", { statusCode: 400 });
// 	try {
// 		const user = await User.findById(userId);
// 		if (!user) throw new Error("Invalid credentials!", { statusCode: 404 });

// 		const userSavingsAccount = user.savingsAccounts;
// 		return userSavingsAccount;
// 	} catch (error) {
// 		throwError(error, "Failed to fetch savings analytics", 500);
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
