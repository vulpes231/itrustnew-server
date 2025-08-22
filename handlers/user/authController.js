const {
	registerService,
	loginService,
	logoutService,
} = require("../../services/user/authService");

const registerUser = async (req, res) => {
	if (!req.body) return res.status(400).json({ message: "Bad request!" });
	try {
		const userData = req.body;
		const { username, email } = await registerService(userData);
		res
			.status(201)
			.json({
				message: `${username} created successfully.`,
				success: true,
				data: null,
			});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const loginUser = async (req, res) => {
	if (!req.body) return res.status(400).json({ message: "Bad request!" });
	try {
		const loginData = req.body;
		const { accessToken, refreshToken, userInfo } = await loginService(
			loginData
		);

		if (userInfo.accountStatus.twoFaActivated) {
			res.status(200).json({
				message: `Verify login.`,
				token: null,
				userInfo,
				otp: userInfo.accountStatus.otp,
			});
		} else {
			res.cookie("jwt", refreshToken, {
				httpOnly: true,
				secure: true,
				maxAge: 1000 * 60 * 60 * 30,
			});

			res.status(200).json({
				message: `Login successfully.`,
				token: accessToken,
				data: userInfo,
				success: true,
			});
		}
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const logoutUser = async (req, res) => {
	const userId = req.user.userId;
	try {
		const loggedOut = await logoutService(userId);
		if (loggedOut) {
			res.clearCookie("jwt", {
				httpOnly: true,
				secure: true,
				maxAge: 1000 * 60 * 60 * 30,
			});
		}
		res
			.status(204)
			.json({ message: "Logout successful.", success: true, data: null });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

module.exports = { registerUser, loginUser, logoutUser };
