const User = require("../models/User");
const { sendMail } = require("../utils/mailer");
const { generateOtp } = require("../utils/utils");

const bcrypt = require("bcrypt");

async function sendLoginCode(email) {
	if (!email) throw new Error("Email required");

	const otp = generateOtp(); // e.g., 6-digit code
	const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

	const subject = "Your iTrust Investments Login Verification Code";
	const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1;">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://www.itrustinvestments.com/logo.png" alt="iTrust Investments" style="max-height: 60px;">
        </div>
        <h2 style="color: #2a5885;">Login Verification</h2>
        <p>Hello,</p>
        <p>We received a request to access your iTrust Investments account. Please use the following verification code:</p>
        
        <div style="background: #f5f5f5; padding: 15px; text-align: center; margin: 25px 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #2a5885;">
            ${otp}
        </div>
        
        <p>This code will expire in 10 minutes. If you didn't request this, please ignore this email or contact support.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
            <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
            <p>This is an automated message - please do not reply directly to this email.</p>
        </div>
    </div>
    `;

	try {
		const user = await User.findOne({ email });
		if (!user) return true;

		const hashedOtp = await bcrypt.hash(otp, 10);
		user.accountStatus.otp = hashedOtp;
		user.accountStatus.otpExpires = otpExpires;
		user.accountStatus.otpAttempts = 0;
		user.accountStatus.otpBlockedUntil = null;

		await user.save();
		await sendMail(email, subject, message);
		return true;
	} catch (error) {
		console.error("OTP send error:", error);
		throw new Error("Failed to send OTP");
	}
}

async function sendMailVerificationCode(email) {
	if (!email) {
		throw new Error("Email required!");
	}

	const otp = generateOtp(); // e.g., 6-digit code
	const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

	const subject = "Verify Your Email Address - iTrust Investments";
	const message = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
            body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { max-height: 50px; }
            .code { 
                background: #f5f7fa; 
                padding: 15px 25px; 
                text-align: center; 
                font-size: 24px; 
                font-weight: bold; 
                letter-spacing: 2px; 
                color: #2c3e50;
                margin: 25px 0;
                border-radius: 4px;
            }
            .footer { 
                margin-top: 40px; 
                padding-top: 20px; 
                border-top: 1px solid #eaeaea; 
                font-size: 12px; 
                color: #7f8c8d;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://www.itrustinvestments.com/logo.png" alt="iTrust Investments" class="logo">
        </div>
        
        <h2 style="color: #2c3e50;">Email Verification Required</h2>
        
        <p>Hello,</p>
        
        <p>Thank you for registering with iTrust Investments. To complete your registration, please enter the following verification code in your application:</p>
        
        <div class="code">${emailCode}</div>
        
        <p>This code will expire in 15 minutes. If you didn't request this verification, please ignore this email or contact our support team immediately.</p>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
            <p>For security reasons, please do not share this code with anyone.</p>
            <p>This is an automated message - please do not reply directly to this email.</p>
        </div>
    </body>
    </html>
    `;

	try {
		const user = await User.findOne({ email });
		if (!user) return true;

		const hashedOtp = await bcrypt.hash(otp, 10);
		user.accountStatus.otp = hashedOtp;
		user.accountStatus.otpExpires = otpExpires;
		user.accountStatus.otpAttempts = 0;
		user.accountStatus.otpBlockedUntil = null;

		await user.save();
		await sendMail(email, subject, message);
		return true;
	} catch (error) {
		console.error("Email sending error:", error.message);
		throw new Error(
			"Failed to send email verification code. Please try again later."
		);
	}
}

async function sendWelcomeMessage(email, firstName) {
	const subject = "Welcome to iTrust Investments - Get Started Today!";
	const message = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { max-height: 50px; }
            .cta-button {
                display: inline-block; 
                background-color: #2c82e0; 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 4px; 
                font-weight: bold; 
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://www.itrustinvestments.com/logo.png" alt="iTrust Investments" class="logo">
        </div>
        
        <h2 style="color: #2c3e50;">Welcome${
					firstName ? `, ${firstName}` : "User"
				}!</h2>
        
        <p>Thank you for verifying your email and joining iTrust Investments.</p>
        
        <p>You're now ready to start your investment journey. Make your first deposit to unlock the full potential of your account:</p>
        
        <p style="text-align: center;">
            <a href="https://app.itrustinvestments.com/deposit" class="cta-button">Make Your First Deposit</a>
        </p>
        
        <p>Need help getting started? Our <a href="https://www.itrustinvestments.com/help">support team</a> is always happy to assist.</p>
        
        <div style="margin-top: 40px; font-size: 12px; color: #7f8c8d;">
            <p>iTrust Investments Team</p>
            <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
        </div>
    </body>
    </html>
    `;

	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.error("Welcome email failed:", error.message);
		throw new Error(
			"Failed to send welcome message. Please contact support if you need assistance."
		);
	}
}

async function sendDepositAlert(email, amount, paymentMethod, currency) {
	// Map payment methods to their full names and icons
	const paymentMethodDetails = {
		btc: { name: "Bitcoin", icon: "🟠" },
		eth: { name: "Ethereum", icon: "🔷" },
		usdt: { name: "USDT", icon: "💲" },
		bank: { name: "Bank Transfer", icon: "🏦" },
	};

	// Currency symbols
	const currencySymbols = {
		usd: "$",
		eur: "€",
		gbp: "£",
	};

	const symbol = currencySymbols[currency.toLowerCase()] || currency;
	const method = paymentMethodDetails[paymentMethod.toLowerCase()] || {
		name: paymentMethod,
		icon: "",
	};

	const subject = `Deposit Successful - ${symbol}${amount} ${currency.toUpperCase()} Received`;

	const message = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { max-height: 50px; }
            .highlight-box { 
                background-color: #f8f9fa; 
                border-left: 4px solid #28a745;
                padding: 15px;
                margin: 20px 0;
            }
            .method-icon { font-size: 24px; margin-right: 10px; vertical-align: middle; }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://www.itrustinvestments.com/logo.png" alt="iTrust Investments" class="logo">
        </div>
        
        <h2 style="color: #2c3e50;">Deposit Received</h2>
        
        <p>Hello,</p>
        
        <div class="highlight-box">
            <p style="font-size: 18px; margin: 0;">
                <span class="method-icon">${method.icon}</span>
                <strong>${symbol}${amount} ${currency.toUpperCase()}</strong> via ${
		method.name
	}
            </p>
        </div>
        
        <p>Your deposit has been successfully credited to your iTrust Investments account and is now available for trading.</p>
        
        <p><strong>Transaction Details:</strong></p>
        <ul>
            <li>Amount: ${symbol}${amount} ${currency.toUpperCase()}</li>
            <li>Payment Method: ${method.name} ${method.icon}</li>
            <li>Status: Completed</li>
            <li>Date: ${new Date().toLocaleString()}</li>
        </ul>
        
        <p>You can now <a href="https://app.itrustinvestments.com/dashboard">log in to your account</a> to start investing.</p>
        
        <div style="margin-top: 40px; font-size: 12px; color: #7f8c8d;">
            <p>If you didn't initiate this deposit, please contact our <a href="https://www.itrustinvestments.com/support">security team</a> immediately.</p>
            <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
        </div>
    </body>
    </html>
    `;

	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.error("Deposit alert failed:", error.message);
		throw new Error(
			"Failed to send deposit alert. Your funds are safe - this is just a notification failure."
		);
	}
}

async function sendWithdrawalAlert(email, amount, paymentMethod, currency) {
	const subject = "Withdrawal completed.";
	const message = ``;
	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to send withdrawal alert.");
	}
}

async function sendTradeAlert(email, action, asset, quantity) {
	// Validate and normalize input
	action = action.toLowerCase();

	const actionVerb =
		{
			bought: "purchased",
			sold: "sold",
			// Add more actions as needed
		}[action] || action;

	const subject = `Trade Confirmation: You ${action} ${quantity} ${asset.name}`;

	const message = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { max-height: 50px; }
            .trade-box { 
                background-color: #f8f9fa; 
                border-left: 4px solid ${
									action === "bought" ? "#28a745" : "#dc3545"
								};
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
            .asset-icon { font-size: 24px; margin-right: 10px; vertical-align: middle; }
            .action-${action} { color: ${
		action === "bought" ? "#28a745" : "#dc3545"
	}; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://www.itrustinvestments.com/logo.png" alt="iTrust Investments" class="logo">
        </div>
        
        <h2 style="color: #2c3e50;">Trade Confirmation</h2>
        
        <p>Hello,</p>
        
        <div class="trade-box">
            <p style="font-size: 18px; margin: 0;">
                <span class="asset-icon">${asset.img}</span>
                You <span class="action-${action}">${actionVerb}</span> 
                <strong>${quantity} ${asset.symbol}${asset.name}</strong> (${
		asset.name
	})
            </p>
        </div>
        
        <p><strong>Trade Details:</strong></p>
        <ul>
            <li>Action: <span class="action-${action}">${action.toUpperCase()}</span></li>
            <li>Asset: ${asset.name} ${asset.img}</li>
            <li>Quantity: ${quantity}</li>
            <li>Ticker: ${asset.symbol}</li>
            <li>Date: ${new Date().toLocaleString()}</li>
        </ul>
        
        <p>You can view this trade in your <a href="https://app.itrustinvestments.com/portfolio">portfolio</a>.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #7f8c8d;">
            <p>This is an automated notification. Please <a href="mailto:support@itrustinvestments.com">contact support</a> 
            if you didn't initiate this trade.</p>
            <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
        </div>
    </body>
    </html>
    `;

	try {
		await sendMail(email, subject, message);
	} catch (error) {
		console.error("Trade alert failed:", error.message);
		throw new Error(
			"Failed to send trade alert. Your trade was successful - this is just a notification failure."
		);
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
