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

module.exports = { fetchUserWallets };
