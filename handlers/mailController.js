const {
	sendLoginCode,
	sendMailVerificationCode,
} = require("../services/mailService");

const sendLoginOtp = async (req, res, next) => {
	const { email } = req.body;
	try {
		await sendLoginCode(email);
		res
			.status(200)
			.json({ message: "Login code resent.", data: null, success: true });
	} catch (error) {
		next(error);
	}
};

const sendMailOtp = async (req, res, next) => {
	const { email } = req.body;
	try {
		await sendMailVerificationCode(email);
		res.status(200).json({
			message: "Email verification code resent.",
			data: null,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { sendLoginOtp, sendMailOtp };
