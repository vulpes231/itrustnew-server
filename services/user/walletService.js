const Wallet = require("../../models/Wallet");
const { throwError } = require("../../utils/utils");

async function fetchUserWallets(userId) {
	try {
		const wallets = await Wallet.find({ userId: userId }).lean();
		return wallets;
	} catch (error) {
		throwError(error, "Failed to fetch user wallets", 500);
	}
}

async function getUserFinancialSummary(userId) {
	try {
		const wallets = await Wallet.find({ userId });

		// Calculate metrics
		const totalBalance = wallets.reduce(
			(sum, wallet) => sum + wallet.totalBalance,
			0
		);
		const totalDailyProfit = wallets.reduce(
			(sum, wallet) => sum + wallet.dailyProfit,
			0
		);
		const totalProfitPercent = (totalDailyProfit / totalBalance) * 100 || 0;

		return {
			totalBalance,
			totalDailyProfit,
			totalProfitPercent: totalProfitPercent.toFixed(2),
		};
	} catch (error) {
		throwError(error, "Failed to fetch financial summary:", 500);
	}
}

module.exports = { fetchUserWallets, getUserFinancialSummary };
