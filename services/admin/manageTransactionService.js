const Transaction = require("../../models/Transaction");
const Wallet = require("../../models/Wallet");
const { fetchTransactionInfo } = require("../user/transactionService");

async function fetchAllTransactions() {
	try {
		const transactions = await Transaction.find();
		if (!transactions) throw new CustomError("Transaction not found!", 404);

		return transactions;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function editTransaction(transactionId, action) {
	if (!transactionId || !action) {
		throw new CustomError("Bad request!", 400);
	}

	const session = await Transaction.startSession();
	session.startTransaction();

	try {
		// Find transaction inside session
		const transaction = await Transaction.findById(transactionId).session(
			session
		);
		if (!transaction) {
			throw new CustomError("Transaction not found!", 404);
		}

		// Find user's wallet
		const transactionWallet = await Wallet.findOne({
			userId: transaction.userId,
			name: transaction.account,
		}).session(session);

		if (!transactionWallet) {
			throw new CustomError("Associated wallet not found!", 404);
		}

		if (action === "approve") {
			transactionWallet.availableBalance += transaction.amount;
			await transactionWallet.save({ session });

			transaction.status = "completed";
			await transaction.save({ session });
		} else if (action === "reject") {
			transaction.status = "failed";
			await transaction.save({ session });
		} else {
			throw new CustomError("Invalid action!", 400);
		}

		// Commit both updates atomically
		await session.commitTransaction();
		session.endSession();

		return transaction;
	} catch (error) {
		// Roll back all changes if any step fails
		await session.abortTransaction();
		session.endSession();
		throw new CustomError(error.message, 500);
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

async function createTransaction(transactionData) {
	const { method, amount, accountId, memo, network, userId, type } =
		transactionData;
	if (!amount || !method || !accountId || !userId)
		throw new CustomError("Bad request!", 400);
	try {
		const wallets = await Wallet.find({ userId });
		if (wallets.length < 1) {
			throw new CustomError("Contact support for more info!", {
				statusCode: 404,
			});
		}

		const receiver = wallets.find((wallet) => wallet._id === accountId);
		if (!receiver) {
			throw new CustomError("Invalid wallet!", 400);
		}
		const customMemo = `${method} ${type} to ${receiver.name}`;

		const trnx = await Transaction.create({
			method: {
				mode: method,
				network: network,
			},
			amount: amount,
			account: receiver.name,
			memo: memo || customMemo,
			type: type,
			userId: userId,
		});
		return trnx;
	} catch (error) {
		throw new CustomError("Failed to add money!", 500);
	}
}

module.exports = {
	getTransactionInfo,
	editTransaction,
	fetchAllTransactions,
	createTransaction,
};
