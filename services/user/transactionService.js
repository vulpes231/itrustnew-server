const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { throwError } = require("../../utils/utils");

async function addFunds(userId, trnxData) {
	const { method, amount, account, memo, network } = trnxData;
	if (!amount || !method || !account)
		throw new Error("Bad request!", { statusCode: 400 });
	try {
		const wallets = await Wallet.find({ userId });
		if (wallets.length < 1) {
			throw new Error("Contact support for more info!", { statusCode: 404 });
		}

		const receiver = wallets.find((wallet) => wallet.name === account);
		if (!receiver) {
			throw new Error("Invalid receiving account!", { statusCode: 400 });
		}
		const customMemo = `${method} deposit to ${account}`;

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
		});
		return trnx;
	} catch (error) {
		throwError(error, "Failed to add money!", 500);
	}
}

async function withdrawFunds(userId, trnxData) {
	const { method, amount, account, memo, network } = trnxData;
	if (!amount || !method || !account)
		throw new Error("Bad request!", { statusCode: 400 });
	try {
		const user = await User.findById(userId);
		if (!user) throw new Error("Invalid credentials!", { statusCode: 404 });

		if (user.identityVerification.kycStatus !== "completed")
			throw new Error("Account not verified!", { statusCode: 403 });

		const wallets = await Wallet.find({ userId });
		if (wallets.length < 1) {
			throw new Error("Contact support for more info!", { statusCode: 404 });
		}

		const withdrawFrom = wallets.find((wallet) => wallet.name === account);
		if (!withdrawFrom)
			throw new Error("Invalid withdrawal account!", { statusCode: 400 });

		if (withdrawFrom.availableBalance < parseFloat(amount))
			throw new Error("Insufficient funds!", { statusCode: 400 });

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
		});
		return trnx;
	} catch (error) {
		throwError(error, "Failed to withdraw money!", 500);
	}
}

async function moveFunds(userId, trnxData) {
	const { method, amount, account, memo } = trnxData;
	if (!amount || !method || !account)
		throw new Error("Bad request!", { statusCode: 400 });
	try {
		const wallets = await Wallet.find({ userId });
		if (wallets.length < 1) {
			throw new Error("Contact support for more info!", { statusCode: 404 });
		}

		const transferFrom = wallets.find((wallet) => wallet.name === method);
		if (!transferFrom)
			throw new Error("Invalid from account!", { statusCode: 400 });

		if (transferFrom.availableBalance < parseFloat(amount))
			throw new Error("Insufficient funds!", { statusCode: 400 });

		const transferTo = wallets.find((wallet) => wallet.name === account);
		if (!transferTo)
			throw new Error("Invalid receiving account!", { statusCode: 400 });

		const parsedAmount = parseFloat(amount);

		transferFrom.totalBalance -= parsedAmount;
		await transferFrom.save();

		transferTo.totalBalance += parsedAmount;
		await transferTo.save();

		const customMemo = `Transfer from ${method} to ${account}`;

		const trnx = await Transaction.create({
			method: {
				mode: method,
				network: "transfer",
			},
			amount: amount,
			account: account,
			memo: memo || customMemo,
			type: "transfer",
			userId: userId,
		});
		return trnx;
	} catch (error) {
		throwError(error, "Failed to move money!", 500);
	}
}

async function getUserLedger(userId) {
	try {
		const transactions = await Transaction.find({ userId }).lean();
		return transactions;
	} catch (error) {
		throwError(error.message, "Failed get user transactions!", 500);
	}
}

async function cancelTransaction(transactionId) {
	try {
		const transaction = await Transaction.findOne({ _id: transactionId });
		transaction.status = "cancelled";
		await transaction.save();
		return transaction;
	} catch (error) {
		throwError(error, "Failed get user transactions!", 500);
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
		throwError(error, "Transaction analytics error:", 500);
	}
}

module.exports = {
	cancelTransaction,
	getUserLedger,
	addFunds,
	withdrawFunds,
	moveFunds,
	getUserTrnxAnalytics,
};
