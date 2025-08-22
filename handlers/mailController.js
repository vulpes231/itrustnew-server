const {
	sendLoginCode,
	sendMailVerificationCode,
} = require("../services/mailService");

const sendLoginOtp = async (req, res) => {
	const { email } = req.body;
	try {
		await sendLoginCode(email);
		res
			.status(200)
			.json({ message: "Login code resent.", data: null, success: true });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const sendMailOtp = async (req, res) => {
	const { email } = req.body;
	try {
		await sendMailVerificationCode(email);
		res
			.status(200)
			.json({
				message: "Email verification code resent.",
				data: null,
				success: true,
			});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

module.exports = { sendLoginOtp, sendMailOtp };
