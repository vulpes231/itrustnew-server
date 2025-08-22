const {
	fetchUserWallets,
	getUserFinancialSummary,
} = require("../../services/user/walletService");

const getUserWallets = async (req, res) => {
	const userId = req.user.userId;
	try {
		const userWallets = await fetchUserWallets(userId);
		res.status(200).json({
			message: "User wallets fetched succesfully",
			data: userWallets,
			success: true,
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getWalletAnalytics = async (req, res) => {
	const userId = req.user.userId;
	try {
		const walletAnalytics = await getUserFinancialSummary(userId);
		res.status(200).json({
			message: "User analytics fetched succesfully",
			data: walletAnalytics,
			success: true,
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

module.exports = { getUserWallets, getWalletAnalytics };
