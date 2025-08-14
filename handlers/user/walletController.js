const { fetchUserWallets } = require("../../services/user/walletService");

const getUserWallets = async (req, res) => {
	const userId = req.user.userId;
	try {
		const userWallets = await fetchUserWallets(userId);
		res
			.status(200)
			.json({ message: "User wallets fetched succesfully", userWallets });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

module.exports = { getUserWallets };
