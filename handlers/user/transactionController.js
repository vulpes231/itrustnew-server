const {
	addFunds,
	withdrawFunds,
	moveFunds,
	getUserLedger,
	cancelTransaction,
	getUserTrnxAnalytics,
} = require("../../services/user/transactionService");

const deposit = async (req, res) => {
	const userId = req.user.userId;
	try {
		const trnxData = req.body;
		await addFunds(userId, trnxData);
		res
			.status(200)
			.json({ message: "Deposit initiated.", success: true, data: null });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const withdraw = async (req, res) => {
	const userId = req.user.userId;
	try {
		const trnxData = req.body;
		await withdrawFunds(userId, trnxData);
		res
			.status(200)
			.json({ message: "Withdrawal initiated.", success: true, data: null });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const transfer = async (req, res) => {
	const userId = req.user.userId;
	try {
		const trnxData = req.body;
		await moveFunds(userId, trnxData);
		res
			.status(200)
			.json({ message: "Transfer completed.", success: true, data: null });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getTransactionHistory = async (req, res) => {
	const userId = req.user.userId;
	try {
		const transactions = await getUserLedger(userId);
		res.status(200).json({ data: transactions, success: true });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const stopTransaction = async (req, res) => {
	const { transactionId } = req.body;
	try {
		await cancelTransaction(transactionId);
		res.status(200).json({ message: "Transaction cancelled.", success: true });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getTransactionAnalytics = async (req, res) => {
	const userId = req.user.userId;
	try {
		const trnxAnalytics = await getUserTrnxAnalytics(userId);
		res.status(200).json({ data: trnxAnalytics, success: true });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
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
