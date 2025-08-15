const Wallet = require("../../models/Wallet");

async function fetchUserWallets(userId) {
	try {
		const wallets = await Wallet.find({ userId: userId });
		return wallets;
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to fetch user wallets");
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
		console.error("Failed to fetch financial summary:", error.message);
		throw new Error("Could not retrieve user financial data");
	}
}

module.exports = { fetchUserWallets, getUserFinancialSummary };
