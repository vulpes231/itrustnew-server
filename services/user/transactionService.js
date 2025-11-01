const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");

async function addFunds(userId, trnxData) {
	const { method, amount, account, memo, network } = trnxData;
	if (!amount || !method || !account || !network)
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

		const receiver = wallets.find((wallet) => wallet.name === account);
		if (!receiver) {
			throw new CustomError("Invalid receiving account!", 400);
		}
		const customMemo = `${method} deposit to ${receiver.name}`;

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
			email: user.credentials.email,
		});
		return trnx;
	} catch (error) {
		throw new CustomError("Failed to add money!", 500);
	}
}

async function withdrawFunds(userId, trnxData) {
	const { method, amount, account, memo, network } = trnxData;
	if (!amount || !method || !account)
		throw new CustomError("Bad request!", 400);
	try {
		const user = await User.findById(userId);
		if (!user) throw new CustomError("Invalid credentials!", 404);

		if (user.identityVerification.kycStatus !== "completed")
			throw new CustomError("Account not verified!", 403);

		const wallets = await Wallet.find({ userId });
		if (wallets.length < 1) {
			throw new CustomError("Contact support for more info!", {
				statusCode: 404,
			});
		}

		const withdrawFrom = wallets.find((wallet) => wallet.name === account);
		if (!withdrawFrom)
			throw new CustomError("Invalid withdrawal account!", 400);

		if (withdrawFrom.availableBalance < parseFloat(amount))
			throw new CustomError("Insufficient funds!", 400);

		const customMemo = `${method} withdrawal from ${account}`;

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
			email: user.credentials.email,
		});
		return trnx;
	} catch (error) {
		throw new CustomError("Failed to withdraw money!", 500);
	}
}

async function moveFunds(userId, trnxData) {
	const { fromWallet, amount, toWallet, memo } = trnxData;
	if (!amount || !fromWallet || !toWallet)
		throw new CustomError("Bad request!", 400);
	try {
		const user = await User.findById(userId);
		if (!user) throw new CustomError("Invalid credentials!", 404);

		const transferFrom = await Wallet.findById(fromWallet);
		if (!transferFrom) throw new CustomError("Invalid from account!", 400);

		if (transferFrom.availableBalance < parseFloat(amount))
			throw new CustomError("Insufficient funds!", 400);

		const transferTo = await Wallet.findById(toWallet);
		if (!transferTo) throw new CustomError("Invalid receiving account!", 400);

		const parsedAmount = parseFloat(amount);

		transferFrom.totalBalance -= parsedAmount;
		transferFrom.availableBalance -= parsedAmount;
		await transferFrom.save();

		transferTo.totalBalance += parsedAmount;
		transferTo.availableBalance += parsedAmount;
		await transferTo.save();

		const customMemo = `Transfer from ${transferFrom.name} to ${transferTo.name}`;

		const trnx = await Transaction.create({
			method: {
				mode: transferFrom.name,
				network: "transfer",
			},
			amount: amount,
			account: transferTo.name,
			memo: memo || customMemo,
			type: "transfer",
			userId: userId,
			email: user.credentials.email,
			status: "completed",
		});
		return trnx;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function getUserLedger(userId) {
	try {
		const transactions = await Transaction.find({ userId }).lean();
		return transactions;
	} catch (error) {
		throw new CustomError(error.message, "Failed get user transactions!", 500);
	}
}

async function cancelTransaction(transactionId) {
	try {
		const transaction = await Transaction.findOne({ _id: transactionId });
		transaction.status = "cancelled";
		await transaction.save();
		return transaction;
	} catch (error) {
		throw new CustomError("Failed get user transactions!", 500);
	}
}

async function getUserTrnxAnalytics(userId) {
	try {
		const transactions = await Transaction.find({ userId });

		// Filter deposits/withdrawals (more efficient with single loop)
		let totalDeposit = 0;
		let totalWithdrawal = 0;

		transactions.forEach((trnx) => {
			if (trnx.type === "deposit") totalDeposit += trnx.amount;
			if (trnx.type === "withdraw") totalWithdrawal += trnx.amount;
		});

		return {
			totalDeposit,
			totalWithdrawal,
			netBalance: totalDeposit - totalWithdrawal,
		};
	} catch (error) {
		throw new CustomError("Transaction analytics error:", 500);
	}
}

async function fetchTransactionInfo(transactionId) {
	if (!transactionId) throw new CustomError("Transaction ID required!", 400);
	try {
		const transaction = await Transaction.findById(transactionId);
		if (!transaction) throw new CustomError("Transaction not found!", 404);

		return transaction;
	} catch (error) {
		throw new CustomError(error.message, 500);
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
