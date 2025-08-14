const { authUser, verifyMail } = require("../../services/user/verifyService");

const verifyLoginCode = async (req, res) => {
	const authData = req.body;
	try {
		const { refreshToken, accessToken, userInfo } = await authUser(authData);
		res.cookie("jwt", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 1000 * 60 * 60 * 30,
		});
		res
			.status(200)
			.json({ message: "Login authenticated", token: accessToken, userInfo });
	} catch (error) {
		console.log("Failed to verify code.", error.message);
		res.status(500).json({ message: error.message });
	}
};

const verifyEmailCode = async (req, res) => {
	const { code } = req.body;
	const userId = req.user.userId;
	try {
		const verifyData = { code, userId };
		await verifyMail(verifyData);
	} catch (error) {
		console.log("Failed to verify email.", error.message);
		res.status(500).json({ message: error.message });
	}
};

const approveAccount = async (req, res) => {};

module.exports = { verifyLoginCode, verifyEmailCode, approveAccount };
