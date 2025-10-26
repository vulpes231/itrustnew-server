const {
	sendLoginCode,
	sendMailVerificationCode,
} = require("../services/mailService");
const { sendMail } = require("../utils/mailer");

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

const sendTestMail = async (req, res, next) => {
	const { email, subject, message } = req.body;
	if (!email || !message)
		return res.status(400).json({ message: "Bad request!" });
	try {
		await sendMail(email, subject, message);
		res.status(200).json({
			message: `Email sent to ${email}`,
			data: null,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { sendLoginOtp, sendMailOtp, sendTestMail };
