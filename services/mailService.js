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
    const user = await User.findOne({ "contactInfo.email": email });
    if (!user) throw new CustomError("User not found!", 400);

    if (
      user.accountStatus.otpSentAt &&
      user.accountStatus.otpExpires > new Date()
    ) {
      console.log("OTP already sent recently — skipping email");
      return { skipped: true };
    }

    const hashedOtp = await bcrypt.hash(otp, 10);
    user.accountStatus.otp = hashedOtp;
    user.accountStatus.otpExpires = otpExpires;
    user.accountStatus.otpAttempts = 0;
    user.accountStatus.otpBlockedUntil = null;

    const sendResult = await sendMail(email, subject, msg);

    user.accountStatus.otpSentAt = new Date();
    await user.save();

    if (!sendResult?.messageId) {
      throw new Error("OTP sent but no messageId returned");
    }
    return {
      status: "OTP sent",
      messageId: sendResult.messageId,
      otpSent: true,
    };
  } catch (error) {
    throw new CustomError("OTP send error!", 500);
  }
}

async function sendMailVerificationCode(subject, email) {
  if (!email) {
    throw new CustomError("Email required!", 400);
  }

  const otp = generateOtp();

  // const subject = "Verify Your Email Address - Itrust Investment";
  const msg = buildEmailMsg(otp);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  try {
    const user = await User.findOne({ "contactInfo.email": email });
    if (!user) throw new CustomError("User not found!", 400);

    if (
      user.accountStatus.otpSentAt &&
      user.accountStatus.otpExpires > new Date()
    ) {
      console.log("OTP already sent recently — skipping email");
      return { skipped: true };
    }

    const hashedOtp = await bcrypt.hash(otp, 10);
    user.accountStatus.otp = hashedOtp;
    user.accountStatus.otpExpires = otpExpires;
    user.accountStatus.otpAttempts = 0;
    user.accountStatus.otpBlockedUntil = null;

    const sendResult = await sendMail(email, subject, msg);

    user.accountStatus.otpSentAt = new Date();
    await user.save();

    if (!sendResult?.messageId) {
      throw new Error("Email sent but no messageId returned");
    }

    return {
      status: "email sent",
      messageId: sendResult.messageId,
      otpSent: true,
    };
  } catch (error) {
    console.error("Failed to send verification email:", {
      email,
      error: error.message,
      stack: error.stack,
    });
    throw new CustomError(
      `Failed to send email verification code: ${error.message}`,
      500,
    );
  }
}

async function sendWelcomeMessage(email, username) {
  const subject = "Welcome to iTrust Investments - Get Started Today!";
  const msg = buildWelcomeMsg(username);
  try {
    await sendMail(email, subject, msg);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

async function sendDepositAlert(email, amount, paymentMethod, currency) {
  const paymentMethodDetails = {
    btc: { name: "Bitcoin", icon: "🟠" },
    eth: { name: "Ethereum", icon: "🔷" },
    usdt: { name: "USDT", icon: "💲" },
    bank: { name: "Bank Transfer", icon: "🏦" },
  };

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
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

async function sendWithdrawalAlert(email, amount, paymentMethod, currency) {
  const subject = "Withdrawal completed.";
  const message = ``;
  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

async function sendTradeAlert(
  email,
  trade,
  closedPortion = null,
  isPartialClose = false,
) {
  if (!trade) throw new CustomError("Incomplete data!", 400);

  const action = trade.orderType;
  const isClosing = trade.status === "closed" || isPartialClose;

  let subject, message;

  if (isClosing) {
    const profitLoss =
      closedPortion?.profitLossClosed || trade.performance.totalReturn;
    const profitLossFormatted =
      profitLoss >= 0
        ? `+$${profitLoss.toFixed(2)}`
        : `-$${Math.abs(profitLoss).toFixed(2)}`;
    const profitLossClass = profitLoss >= 0 ? "profit" : "loss";

    const closeType =
      closedPortion?.percentClosed === 100
        ? "Closed"
        : `Partially Closed (${closedPortion?.percentClosed}%)`;

    subject = `${closeType} Trade: ${trade.asset.symbol.toUpperCase()} - ${profitLossFormatted}`;

    message = `
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
                  border-left: 4px solid ${profitLoss >= 0 ? "#28a745" : "#dc3545"};
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 4px;
              }
              .profit { color: #28a745; font-weight: bold; }
              .loss { color: #dc3545; font-weight: bold; }
              .info-box {
                  background-color: #e9ecef;
                  padding: 10px;
                  margin: 10px 0;
                  border-radius: 4px;
              }
          </style>
      </head>
      <body>
          <div class="header">
              <img src="https://itrustinvestment.netlify.app/logo.png" alt="iTrust Investments" class="logo">
          </div>
          
          <h2 style="color: #2c3e50;">${closeType} Trade Confirmation</h2>
          
          <p>Hello,</p>
          
          <div class="trade-box">
              <p style="font-size: 18px; margin: 0;">
                  <span class="asset-icon">${trade.asset.img || "📊"}</span>
                  Your ${trade.orderType.toUpperCase()} position in 
                  <strong>${trade.asset.symbol} (${trade.asset.name})</strong> has been ${closedPortion?.percentClosed === 100 ? "closed" : "partially closed"}
              </p>
          </div>
          
          ${
            isPartialClose
              ? `
          <div class="info-box">
              <p><strong>Partial Close Details:</strong></p>
              <ul>
                  <li>Closed Percentage: ${closedPortion?.percentClosed}%</li>
                  <li>Principal Closed: $${closedPortion?.principalClosed?.toFixed(2)}</li>
                  <li>Remaining Principal: $${closedPortion?.remainingPrincipal?.toFixed(2)}</li>
                  <li>Remaining Quantity: ${(trade.execution.quantity || 0).toFixed(4)}</li>
              </ul>
          </div>
          `
              : ""
          }
          
          <p><strong>Trade Performance:</strong></p>
          <ul>
              <li>Action: ${trade.orderType.toUpperCase()}</li>
              <li>Asset: ${trade.asset.name}</li>
              <li>Exit Price: $${(closedPortion?.exitPrice || trade.targets?.exitPoint || "N/A").toFixed(2)}</li>
              <li>Profit/Loss: <span class="${profitLossClass}">${profitLossFormatted}</span></li>
              <li>Closed Date: ${new Date().toLocaleString()}</li>
          </ul>
          
          ${
            closedPortion?.percentClosed !== 100
              ? `
          <p>Your remaining position is still active. You can close more later from your portfolio.</p>
          `
              : ""
          }
          
          <p>View your updated portfolio <a href="https://itrustinvestment.netlify.app">here</a>.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #7f8c6d;">
              <p>This is an automated notification. Please <a href="mailto:support@itrustinvestments.com">contact support</a> 
              if you didn't initiate this trade.</p>
              <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
          </div>
      </body>
      </html>
    `;
  } else {
    const actionVerb =
      {
        buy: "purchased",
        sell: "sold",
      }[action] || action;

    const qty = trade.execution.quantity;
    const parsedQty = parseFloat(qty).toFixed(6);

    subject = `Trade Confirmation: You ${actionVerb} ${parsedQty} ${trade.asset.symbol.toUpperCase()}`;

    message = `
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
                  action === "buy" ? "#28a745" : "#dc3545"
                };
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
            .asset-icon { font-size: 24px; margin-right: 10px; vertical-align: middle; }
            .action-${action} { color: ${
              action === "buy" ? "#28a745" : "#dc3545"
            }; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://itrustinvestment.netlify.app/logo.png" alt="iTrust Investments" class="logo">
        </div>
        
        <h2 style="color: #2c3e50;">Trade Confirmation</h2>
        
        <p>Hello,</p>
        
        <div class="trade-box">
            <p style="font-size: 18px; margin: 0;">
                <img class="asset-icon src=${trade.asset.img} width="30px" height="30px"/>
                You <span class="action-${action}">${actionVerb}</span> 
                <strong>${parsedQty} ${trade.asset.symbol}</strong> (${
                  trade.asset.name
                })
            </p>
        </div>
        
        <p><strong>Trade Details:</strong></p>
        <ul>
            <li>Action: <span class="action-${action}">${action.toUpperCase()}</span></li>
            <li>Asset: ${trade.asset.name} </li>
            <li>Quantity: ${parsedQty}</li>
            <li>Ticker: ${trade.asset.symbol}</li>
            <li>Date: ${new Date().toLocaleString()}</li>
        </ul>
        
        <p>You can view this trade in your <a href="https://itrustinvestment.netlify.app">portfolio</a>.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #7f8c8d;">
            <p>This is an automated notification. Please <a href="mailto:support@itrustinvestments.com">contact support</a> 
            if you didn't initiate this trade.</p>
            <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
        </div>
    </body>
    </html>
    `;
  }

  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
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
