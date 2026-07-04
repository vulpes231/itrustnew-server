const User = require("../models/User");
const { sendMail } = require("../utils/mailer");
const {
  buildEmailMsg,
  buildTwoFaMsg,
  buildWelcomeMsg,
  buildTransactionEmail,
  buildTradeMessage,
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

async function sendMailVerificationCode(
  subject = "Your Verification Code",
  email,
) {
  if (!email) {
    throw new CustomError("Email required!", 400);
  }

  const otp = generateOtp();

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

async function sendDepositAlert(email, transaction, currency) {
  const method = transaction?.method?.mode;
  const symbol = currency?.sign;
  const currencyName = currency?.symbol?.toUpperCase();
  const amount = transaction?.amount;

  const subject = `Deposit Successful - ${symbol}${amount} ${currencyName} Received`;

  const message = buildTransactionEmail({
    type: "Deposit Successful",
    amount,
    symbol,
    currencyName,
    method,
    status: "Completed",
    buttonText: "Go to Dashboard",
    buttonLink: "https://itrustinvestment.netlify.app/dashboard",
    message:
      "Your deposit has been received successfully and credited to your iTrust Investments account.",
  });

  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message, 500);
  }
}

async function sendWithdrawalAlert(email, transaction, currency) {
  const method = transaction?.method?.mode;
  const symbol = currency?.sign;
  const currencyName = currency?.symbol?.toUpperCase();
  const amount = transaction?.amount;

  const subject = `Withdrawal Successful - ${symbol}${amount} ${currencyName}`;

  const message = buildTransactionEmail({
    type: "Withdrawal Processed",
    amount,
    symbol,
    currencyName,
    method,
    status: "Processed",
    buttonText: "View Dashboard",
    buttonLink: "https://itrustinvestment.netlify.app/dashboard",
    message:
      "Your withdrawal request has been processed successfully. The funds are on their way to your selected payment destination.",
  });

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

    message = buildTradeMessage({
      title: `${closeType} Trade Confirmation`,
      message: `
            Your ${trade.orderType.toUpperCase()} position in
            <strong>${trade.asset.symbol} (${trade.asset.name})</strong>
            has been ${
              closedPortion?.percentClosed === 100
                ? "closed"
                : "partially closed"
            }
        `,
      trade,
      actionColor: profitLoss >= 0 ? "#28a745" : "#dc3545",
      actionLabel: closeType,
      isClosing: true,
      profitLoss,
      profitLossFormatted,
      profitLossClass,
      closeType,
      closedPortion,
    });
  } else {
    const actionVerb =
      {
        buy: "purchased",
        sell: "sold",
      }[action] || action;

    const qty = trade.execution.quantity;
    const parsedQty = parseFloat(qty).toFixed(6);

    subject = `Trade Confirmation: You ${actionVerb} ${parsedQty} ${trade.asset.symbol.toUpperCase()}`;

    message = buildTradeMessage({
      title: "Trade Confirmation",
      message: `
            You 
            <strong style="color:${action === "buy" ? "#28a745" : "#dc3545"};">
                ${actionVerb.toUpperCase()}
            </strong>
            ${parsedQty} ${trade.asset.symbol} (${trade.asset.name})
        `,
      trade,
      actionColor: action === "buy" ? "#28a745" : "#dc3545",
      actionLabel: action.toUpperCase(),
    });
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
