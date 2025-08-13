const User = require("../../models/User");
const { registerService } = require("../../services/user/authService");

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

module.exports = { registerUser };
