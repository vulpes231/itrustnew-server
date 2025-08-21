const {
	fetchAvailableSavings,
	addSavingsAccount,
	fetchUserSavingsHistory,
	fundSavings,
	withdrawSavings,
} = require("../../services/user/savingsService");

const getSavingsAccounts = async (req, res) => {
	try {
		const accounts = await fetchAvailableSavings();
		res.status(200).json({
			message: "Savings account fetched successfully",
			data: accounts,
			success: true,
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const createSavingsAccounts = async (req, res) => {
	const userId = req.user.userId;
	const { accountId } = req.body;
	try {
		const acctName = await addSavingsAccount(userId, accountId);
		res.status(201).json({
			message: `${acctName} account opened successfully`,
			data: null,
			success: true,
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getSavingsHistory = async (req, res) => {
	const userId = req.user.userId;
	const limit = Math.min(50, parseInt(req.query.limit) || 15);
	const page = Math.max(1, parseInt(req.query.page) || 1);
	const sortBy = req.query.sortBy;
	try {
		const { savingsHistory, totalPage, totalItem, currentPage } =
			await fetchUserSavingsHistory(userId, {
				page,
				limit,
				sortBy,
			});
		res.status(200).json({
			message: `Savings history fetched`,
			data: savingsHistory,
			success: true,
			pagination: {
				currentPage,
				totalResult: totalItem,
				totalPages: totalPage,
			},
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const contributeSavings = async (req, res) => {
	const userId = req.user.userId;
	const fundData = req.body;
	try {
		await fundSavings(userId, fundData);
		res.status(200).json({
			message: `Contribution successful`,
			data: null,
			success: true,
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const cashoutSavings = async (req, res) => {
	const userId = req.user.userId;
	const withdrawData = req.body;
	try {
		const acctName = await withdrawSavings(userId, withdrawData);
		res.status(200).json({
			message: `Cashout successful`,
			data: null,
			success: true,
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

module.exports = {
	cashoutSavings,
	contributeSavings,
	getSavingsHistory,
	getSavingsAccounts,
	createSavingsAccounts,
};
