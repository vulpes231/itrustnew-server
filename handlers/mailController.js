const {
	sendLoginCode,
	sendMailVerificationCode,
} = require("../services/mailService");

const sendLoginOtp = async (req, res) => {
	const { email } = req.body;
	try {
		await sendLoginCode(email);
		res.status(200).json({ message: "Login code resent." });
	} catch (error) {
		console.log(error.message);
		res.status(500).json({ message: error.message });
	}
};

const sendMailOtp = async (req, res) => {
	const { email } = req.body;
	try {
		await sendMailVerificationCode(email);
		res.status(200).json({ message: "Email verification code resent." });
	} catch (error) {
		console.log(error.message);
		res.status(500).json({ message: error.message });
	}
};

module.exports = { sendLoginOtp, sendMailOtp };
