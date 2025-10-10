const {
	newSavingsAccount,
	editSavingsAccount,
	deleteSavingsAccount,
	fetchAllSavingsAccount,
} = require("../../services/admin/manageSavingService");

const adminCreateSavings = async (req, res, next) => {
	try {
		const acctData = req.body;
		const acct = await newSavingsAccount(acctData);
		res
			.status(200)
			.json({ message: "Savings account created.", data: acct, success: true });
	} catch (error) {
		next(error);
	}
};

const adminEditSavings = async (req, res, next) => {
	const { accountId } = req.params;
	try {
		const acctData = { ...req.body, accountId };
		const acct = await editSavingsAccount(acctData);
		res
			.status(200)
			.json({ message: "Savings account updated.", data: acct, success: true });
	} catch (error) {
		next(error);
	}
};

const adminDeleteSavings = async (req, res, next) => {
	const { accountId } = req.params;
	try {
		await deleteSavingsAccount(accountId);
		res
			.status(200)
			.json({ message: "Savings account deleted.", data: null, success: true });
	} catch (error) {
		next(error);
	}
};

const getAllSavingsAccounts = async (req, res, next) => {
	try {
		const savingsAccounts = await fetchAllSavingsAccount();
		res.status(200).json({
			message: "Savings account fetched successfully.",
			data: savingsAccounts,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = {
	adminCreateSavings,
	adminEditSavings,
	adminDeleteSavings,
	getAllSavingsAccounts,
};
