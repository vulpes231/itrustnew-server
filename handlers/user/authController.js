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
		res.status(201).json({ message: `${username} created successfully.` });
	} catch (error) {
		console.log("Failed to register user.", error.message);
		res.status(500).json({ message: error.message });
	}
};

const loginUser = async (req, res) => {
	if (!req.body) return res.status(400).json({ message: "Bad request!" });
	try {
		const loginData = req.body;
		const { accessToken, refreshToken, userInfo } = await loginService(
			loginData
		);
		res.cookie("jwt", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 1000 * 60 * 60 * 30,
		});
		res
			.status(200)
			.json({ message: `Login successfully.`, token: accessToken, userInfo });
	} catch (error) {
		console.log("Login failed.", error.message);
		res.status(500).json({ message: error.message });
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
		res.status(204).json({ message: "Logout successful." });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

module.exports = { registerUser, loginUser, logoutUser };
