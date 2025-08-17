const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");

async function addFunds(userId, trnxData) {
	const { method, amount, account, memo, network } = trnxData;
	if (!amount || !method || !account) throw new Error("Bad request!");
	try {
		const wallets = await Wallet.find({ userId });
		if (wallets.length < 1) {
			throw new Error("Contact support for more info!");
		}

		const receiver = wallets.find((wallet) => wallet.name === account);
		if (!receiver) {
			throw new Error("Invalid receiving account!");
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
		console.log(error.message);
		throw new Error("Failed to add money!");
	}
}

async function withdrawFunds(userId, trnxData) {
	const { method, amount, account, memo, network } = trnxData;
	if (!amount || !method || !account) throw new Error("Bad request!");
	try {
		const user = await User.findById(userId);
		if (!user) throw new Error("Invalid credentials!");

		if (user.identityVerification.kycStatus !== "completed")
			throw new Error("Account not verified!");

		const wallets = await Wallet.find({ userId });
		if (wallets.length < 1) {
			throw new Error("Contact support for more info!");
		}

		const withdrawFrom = wallets.find((wallet) => wallet.name === account);
		if (!withdrawFrom) throw new Error("Invalid withdrawal account!");

		if (withdrawFrom.availableBalance < parseFloat(amount))
			throw new Error("Insufficient funds!");

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
		console.log(error.message);
		throw new Error("Failed to withdraw money!");
	}
}

async function moveFunds(userId, trnxData) {
	const { method, amount, account, memo, network } = trnxData;
	if (!amount || !method || !account) throw new Error("Bad request!");
	try {
		const wallets = await Wallet.find({ userId });
		if (wallets.length < 1) {
			throw new Error("Contact support for more info!");
		}

		const transferFrom = wallets.find((wallet) => wallet.name === method);
		if (!transferFrom) throw new Error("Invalid from account!");

		if (transferFrom.availableBalance < parseFloat(amount))
			throw new Error("Insufficient funds!");

		const transferTo = wallets.find((wallet) => wallet.name === account);
		if (!transferTo) throw new Error("Invalid receiving account!");

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
		console.log(error.message);
		throw new Error("Failed to move money!");
	}
}

async function getUserLedger(userId) {
	try {
		const transactions = await Transaction.find({ userId });
		return transactions;
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed get user transactions!");
	}
}

async function cancelTransaction(transactionId) {
	try {
		const transaction = await Transaction.findOne({ _id: transactionId });
		transaction.status = "cancelled";
		await transaction.save();
		return transaction;
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed get user transactions!");
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
		console.error("Transaction analytics error:", error.message);
		throw new Error("Failed to fetch transaction analytics");
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
