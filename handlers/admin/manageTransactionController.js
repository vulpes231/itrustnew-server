const {
	fetchAllTransactions,
	getTransactionInfo,
	editTransaction,
	createTransaction,
} = require("../../services/admin/manageTransactionService");

const getTransactionData = async (req, res, next) => {
	const { transactionId } = req.params;
	try {
		const transaction = await getTransactionInfo(transactionId);
		res.status(200).json({
			data: transaction,
			success: true,
			message: "transaction data fetched successfully",
		});
	} catch (error) {
		next(error);
	}
};

const getAllTransactions = async (req, res, next) => {
	try {
		const transactions = await fetchAllTransactions();
		res.status(200).json({
			data: transactions,
			success: true,
			message: "transactions fetched successfully",
		});
	} catch (error) {
		next(error);
	}
};

const updateTransaction = async (req, res, next) => {
	const { transactionId } = req.params;
	const { action } = req.body;
	try {
		await editTransaction(transactionId, action);
		res.status(200).json({
			data: null,
			success: true,
			message: "transaction updated successfully",
		});
	} catch (error) {
		next(error);
	}
};

const adminCreateTransaction = async (req, res, next) => {
	try {
		const trnxData = req.body;
		await createTransaction(trnxData);
		res.status(200).json({
			message: `${req.body.type} initiated`,
			success: true,
			data: null,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = {
	updateTransaction,
	getAllTransactions,
	getTransactionData,
	adminCreateTransaction,
};
