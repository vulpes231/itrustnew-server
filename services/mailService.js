const User = require("../models/User");
const { sendMail } = require("../utils/mailer");
const {
  buildEmailMsg,
  buildTwoFaMsg,
  buildWelcomeMsg,
} = require("../utils/messages");
const { generateOtp, CustomError } = require("../utils/utils");
const bcrypt = require("bcryptjs");

async function sendLoginCode(email) {
  if (!email) throw new CustomError("Email required!", 400);

  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  const subject = "Your iTrust Investments Login Verification Code";

  const msg = buildTwoFaMsg(otp);

  try {
    const user = await User.findOne({ email });
    if (!user) return true;

    const hashedOtp = await bcrypt.hash(otp, 10);
    user.accountStatus.otp = hashedOtp;
    user.accountStatus.otpExpires = otpExpires;
    user.accountStatus.otpAttempts = 0;
    user.accountStatus.otpBlockedUntil = null;

    await user.save();
    await sendMail(email, subject, twoFaMessage);
    return true;
  } catch (error) {
    throw new CustomError("OTP send error!", 500);
  }
}

async function sendMailVerificationCode(email) {
  if (!email) {
    throw new CustomError("Email required!", 400);
  }

  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  const subject = "Verify Your Email Address - iTrust Investments";
  const msg = buildEmailMsg(otp);

  try {
    const user = await User.findOne({ email });
    if (!user) return true;

    const hashedOtp = await bcrypt.hash(otp, 10);
    user.accountStatus.otp = hashedOtp;
    user.accountStatus.otpExpires = otpExpires;
    user.accountStatus.otpAttempts = 0;
    user.accountStatus.otpBlockedUntil = null;

    await user.save();

    const emailResult = await sendMail(email, subject, msg);
    console.log(
      "📧 Email sending completed:",
      emailResult ? "Success" : "Failed"
    );

    return true;
  } catch (error) {
    console.log("❌ Failed to send verification email:", error);
    throw new CustomError(
      "Failed to send email verification code! Please try again later.",
      error.statusCode
    );
  }
}

async function sendWelcomeMessage(email, username) {
  const subject = "Welcome to iTrust Investments - Get Started Today!";
  const msg = buildWelcomeMsg(username);
  try {
    await sendMail(email, subject, msg);
  } catch (error) {
    throw new CustomError(
      "Failed to send welcome message! Please contact support if you need assistance.",
      error.statusCode
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
    throw new CustomError(
      "Failed to send deposit alert. Your funds are safe - this is just a notification failure!",
      500
    );
  }
}

async function sendWithdrawalAlert(email, amount, paymentMethod, currency) {
  const subject = "Withdrawal completed.";
  const message = ``;
  try {
    await sendMail(email, subject, message);
  } catch (error) {
    throw new CustomError("Failed to send withdrawal alert!", 500);
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
    throw new CustomError("Failed to send trade alert!", 500);
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
