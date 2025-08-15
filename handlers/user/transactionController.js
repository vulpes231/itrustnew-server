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
		res.status(200).json({ message: "Deposit initiated." });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const withdraw = async (req, res) => {
	const userId = req.user.userId;
	try {
		const trnxData = req.body;
		await withdrawFunds(userId, trnxData);
		res.status(200).json({ message: "Withdrawal initiated." });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const transfer = async (req, res) => {
	const userId = req.user.userId;
	try {
		const trnxData = req.body;
		await moveFunds(userId, trnxData);
		res.status(200).json({ message: "Transfer completed." });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getTransactionHistory = async (req, res) => {
	const userId = req.user.userId;
	try {
		const transactions = await getUserLedger(userId);
		res.status(200).json({ transactions });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const stopTransaction = async (req, res) => {
	const { transactionId } = req.body;
	try {
		await cancelTransaction(transactionId);
		res.status(200).json({ message: "Transaction cancelled." });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getTransactionAnalytics = async (req, res) => {
	const userId = req.user.userId;
	try {
		const trnxAnalytics = await getUserTrnxAnalytics(userId);
		res.status(200).json({ trnxAnalytics });
	} catch (error) {
		res.status(500).json({ message: error.message });
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
