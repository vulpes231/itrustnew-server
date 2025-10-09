const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");
const { fetchTransactionInfo } = require("../user/transactionService");

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
		if (transaction.status === "completed") {
			throw new CustomError("Action already completed!", 404);
		}

		const transactionWallet = await Wallet.findOne({
			userId: transaction.userId,
			name: transaction.account,
		}).session(session);

		if (!transactionWallet) {
			throw new CustomError("Associated wallet not found!", 404);
		}

		if (action === "approve") {
			transactionWallet.availableBalance += transaction.amount;
			transactionWallet.totalBalance += transaction.amount;
			await transactionWallet.save({ session });

			transaction.status = "completed";
			await transaction.save({ session });
		} else if (action === "reject") {
			transaction.status = "failed";
			await transaction.save({ session });
		} else {
			throw new CustomError("Invalid action!", 400);
		}

		await session.commitTransaction();
		session.endSession();

		return transaction;
	} catch (error) {
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
		const user = await User.findById(userId);
		if (!user) throw new CustomError("Invalid credentials!", 404);

		const wallets = await Wallet.find({ userId });
		if (wallets.length < 1) {
			throw new CustomError("Contact support for more info!", {
				statusCode: 404,
			});
		}

		// console.log(wallets);
		// console.log(accountId);

		const receiver = wallets.find(
			(wallet) => wallet._id.toString() === accountId
		);
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
			email: user.credentials.email,
		});
		return trnx;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

module.exports = {
	getTransactionInfo,
	editTransaction,
	fetchAllTransactions,
	createTransaction,
};
