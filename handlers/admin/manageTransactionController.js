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
	const sortBy = req.query.sortBy;
	const limit = Math.min(req.query.limit || 15);
	const page = Math.max(req.query.page || 1);
	const filterBy = req.query.filterBy;
	try {
		const { transactions, totalTrnxs, totalPages, currentPage } =
			await fetchAllTransactions({
				sortBy,
				limit,
				page,
				filterBy,
			});
		res.status(200).json({
			data: transactions,
			success: true,
			message: "transactions fetched successfully",
			pagination: {
				totalPage: totalPages,
				totalItem: totalTrnxs,
				currentPage: currentPage,
			},
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
