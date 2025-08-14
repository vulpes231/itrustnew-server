const { sendMail } = require("../utils/mailer");

async function sendLoginCode(email) {
	const subject = "Verify Login";
	const message = ``;
	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to send login code.");
	}
}

async function sendMailVerificationCode(email) {
	const subject = "Verify your email address";
	const message = ``;
	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to send email verification code.");
	}
}

async function sendWelcomeMessage(email) {
	const subject = "Welcome to Itrust Investments.";
	const message = ``;
	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to send welcome message.");
	}
}

async function sendDepositAlert(email) {
	const subject = "Deposit Successful";
	const message = ``;
	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to send deposit alert.");
	}
}

async function sendWithdrawalAlert(email) {
	const subject = "Withdrawal completed.";
	const message = ``;
	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to send withdrawal alert.");
	}
}

async function sendTradeAlert(email) {
	const subject = "New trade notification";
	const message = ``;
	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to send trade alert.");
	}
}

module.exports = {
	sendDepositAlert,
	sendWithdrawalAlert,
	sendTradeAlert,
	sendMailVerificationCode,
	sendWelcomeMessage,
	sendLoginCode,
};
