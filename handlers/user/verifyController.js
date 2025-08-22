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
		res.status(200).json({
			message: "Login authenticated",
			token: accessToken,
			data: userInfo,
			success: true,
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const verifyEmailCode = async (req, res) => {
	const { code } = req.body;
	const userId = req.user.userId;
	try {
		const verifyData = { code, userId };
		await verifyMail(verifyData);
		res
			.status(200)
			.json({ message: "Email verified.", success: true, data: null });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const approveAccount = async (req, res) => {};

module.exports = { verifyLoginCode, verifyEmailCode };
