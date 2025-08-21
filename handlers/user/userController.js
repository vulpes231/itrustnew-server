const {
	getUserById,
	updateUserProfile,
	updatePassword,
	updateBeneficiary,
	updateTwoFactorAuth,
} = require("../../services/user/userService");

const getUserInfo = async (req, res) => {
	const userId = req.user.userId;
	try {
		const user = await getUserById(userId);
		res.status(200).json({ message: "User fetched successfully.", user });
	} catch (error) {
		const statusCode = error.statusCode;
		res.status(statusCode).json({ message: error.message });
	}
};

const editUserInfo = async (req, res) => {
	const userId = req.user.userId;
	try {
		const userData = req.body;
		await updateUserProfile(userId, userData);
		res.status(200).json({ message: "User updated successfully." });
	} catch (error) {
		const statusCode = error.statusCode;
		res.status(statusCode).json({ message: error.message });
	}
};

const changePassword = async (req, res) => {
	const userId = req.user.userId;
	try {
		const userData = req.body;
		await updatePassword(userId, userData);
		res.status(200).json({ message: "Password updated successfully." });
	} catch (error) {
		const statusCode = error.statusCode;
		res.status(statusCode).json({ message: error.message });
	}
};

const setBeneficiary = async (req, res) => {
	const userId = req.user.userId;
	try {
		const userData = req.body;
		const user = await updateBeneficiary(userId, userData);
		res.status(200).json({ message: "Beneficiary updated successfully." });
	} catch (error) {
		const statusCode = error.statusCode;
		res.status(statusCode).json({ message: error.message });
	}
};

const setTwoFactor = async (req, res) => {
	const userId = req.user.userId;
	try {
		await updateTwoFactorAuth(userId);
		res.status(200).json({ message: "2FA updated successfully." });
	} catch (error) {
		const statusCode = error.statusCode;
		res.status(statusCode).json({ message: error.message });
	}
};

module.exports = {
	getUserInfo,
	setBeneficiary,
	setTwoFactor,
	changePassword,
	editUserInfo,
};
