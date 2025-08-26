const {
	addFunds,
	withdrawFunds,
	moveFunds,
	getUserLedger,
	cancelTransaction,
	getUserTrnxAnalytics,
} = require("../../services/user/transactionService");

const deposit = async (req, res, next) => {
	const userId = req.user.userId;
	try {
		const trnxData = req.body;
		await addFunds(userId, trnxData);
		res
			.status(200)
			.json({ message: "Deposit initiated.", success: true, data: null });
	} catch (error) {
		next(error);
	}
};

const withdraw = async (req, res, next) => {
	const userId = req.user.userId;
	try {
		const trnxData = req.body;
		await withdrawFunds(userId, trnxData);
		res
			.status(200)
			.json({ message: "Withdrawal initiated.", success: true, data: null });
	} catch (error) {
		next(error);
	}
};

const transfer = async (req, res, next) => {
	const userId = req.user.userId;
	try {
		const trnxData = req.body;
		await moveFunds(userId, trnxData);
		res
			.status(200)
			.json({ message: "Transfer completed.", success: true, data: null });
	} catch (error) {
		next(error);
	}
};

const getTransactionHistory = async (req, res, next) => {
	const userId = req.user.userId;
	try {
		const transactions = await getUserLedger(userId);
		res.status(200).json({ data: transactions, success: true });
	} catch (error) {
		next(error);
	}
};

const stopTransaction = async (req, res, next) => {
	const { transactionId } = req.body;
	try {
		await cancelTransaction(transactionId);
		res.status(200).json({ message: "Transaction cancelled.", success: true });
	} catch (error) {
		next(error);
	}
};

const getTransactionAnalytics = async (req, res, next) => {
	const userId = req.user.userId;
	try {
		const trnxAnalytics = await getUserTrnxAnalytics(userId);
		res.status(200).json({ data: trnxAnalytics, success: true });
	} catch (error) {
		next(error);
	}
};

module.exports = {
	deposit,
	withdraw,
	transfer,
	getTransactionHistory,
	stopTransaction,
	getTransactionAnalytics,
};
