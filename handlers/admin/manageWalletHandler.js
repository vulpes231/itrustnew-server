const { fetchUserWallets } = require("../../services/user/walletService");

const adminGetUserWallets = async (req, res, next) => {
	const { userId } = req.params;
	try {
		const wallets = await fetchUserWallets(userId);
		res.status(200).json({
			message: "User wallets retrieved successfully",
			data: wallets,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { adminGetUserWallets };
