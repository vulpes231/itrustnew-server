const User = require("../models/User");
const { sendMail } = require("../utils/mailer");
const {
  buildDepositEmail,
  buildDepositApprovedEmail,
  buildDepositDeclinedEmail,
} = require("../utils/messages/deposit/depositMessages");
const {
  buildIdentityVerifiedMsg,
} = require("../utils/messages/kyc/verificationMsg");
const { buildEmailMsg } = require("../utils/messages/otp/emailMessage");
const {
  buildSavingsCreatedEmail,
  buildContributionEmail,
  buildCashoutReqEmail,
} = require("../utils/messages/savings/savingsMessage");
const {
  buildBuyOrderEmail,
  buildSellOrderEmail,
} = require("../utils/messages/trade/tradeMessages");
const {
  buildTransferEmail,
} = require("../utils/messages/transfer/transferMessages");
const {
  buildWithdrawalEmail,
  buildWithdrawalApprovedEmail,
  buildWithdrawalDeclinedEmail,
} = require("../utils/messages/withdraw/withdrawMessages");
const { generateOtp, CustomError } = require("../utils/utils");
const bcrypt = require("bcryptjs");

// USER OTP EMAILS
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
  if (!subject || !email) {
    throw new CustomError("Email and subject required!", 400);
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
    throw new CustomError(
      `Failed to send email verification code: ${error.message}`,
      500,
    );
  }
}

//USER DEPOSIT EMAILS
async function sendDepositRequestAlert(user, transaction, settings) {
  const subject = `Deposit Request Confirmation`;

  const message = buildDepositEmail({ user, transaction, settings });

  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message, 500);
  }
}

async function sendDepositApprovedAlert(user, transaction) {
  const email = user.contactInfo.email;
  const subject = `Deposit Processed`;

  const message = buildDepositApprovedEmail({ user, transaction });

  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message, 500);
  }
}

async function sendDepositDeclineAlert(user, transaction) {
  const email = user.contactInfo.email;
  const subject = `Deposit Declined`;

  const message = buildDepositDeclinedEmail({ user, transaction });

  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message, 500);
  }
}

// USER WITHDRAWAL EMAILS
async function sendWithdrawalRequestAlert(user, transaction) {
  const email = user.contactInfo.email;
  const subject = `Withdrawal Request Confirmation`;

  const message = buildWithdrawalEmail({ user, transaction });

  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message, 500);
  }
}

async function sendWithdrawalApprovedAlert(user, transaction) {
  const email = user.contactInfo.email;

  const subject = `Withdrawal Processed`;

  const message = buildWithdrawalApprovedEmail({ user, transaction });
  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message, 500);
  }
}

async function sendWithdrawalDeclinedAlert(user, transaction) {
  const subject = `Withdrawal Declined`;

  const message = buildWithdrawalDeclinedEmail({
    user,
    transaction,
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

// USER TRADE ALERTS
async function sendBuyAlert(user, trade) {
  const email = user.contactInfo.email;

  const subject = "Purchase Order Confirmed";

  const message = buildBuyOrderEmail({ user, trade });
  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

async function sendSellAlert(user, trade) {
  const email = user.contactInfo.email;

  const subject = "Sale Order Confirmed";

  const message = buildSellOrderEmail({ user, trade });
  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

// USER WELCOME ALERT
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

//USER KYC ALERTS
async function sendIdVerifiedAlert(user) {
  const email = user.contactInfo.email;
  const username = user.personalInfo.username;

  const subject = "ID Verified";

  const message = buildIdentityVerifiedMsg(username);
  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

//USER TRANSFER EMAIL
async function sendTranferAlert(user, transaction) {
  const email = user.contactInfo.email;
  const subject = `Transfer to ${transaction.meta.to}`;

  const message = buildTransferEmail({ user, transaction });

  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message, 500);
  }
}

//USER SAVINGS ACCOUNTS EMAIL
async function sendSavingsCreatedAlert(user, account) {
  const email = user.contactInfo.email;
  const subject = `Your ${account.name} Account Has Been Successfuly Created`;

  const message = buildSavingsCreatedEmail({ user, account });

  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message, 500);
  }
}

async function sendContributionAlert(user, transaction) {
  const email = user.contactInfo.email;
  const subject = `Contribution to ${transaction.account}`;

  const message = buildContributionEmail({ user, transaction });

  try {
    await sendMail(email, subject, message);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(error.message, 500);
  }
}

async function sendCashoutRequestAlert(user, transaction) {
  const email = user.contactInfo.email;
  const subject = `Cashout Request from ${transaction.account}`;

  const message = buildCashoutReqEmail({ user, transaction });

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
  sendMailVerificationCode, //otp
  sendWelcomeMessage,
  sendLoginCode,
  sendBuyAlert, //trade
  sendSellAlert,
  sendDepositRequestAlert, //deposit
  sendDepositApprovedAlert,
  sendDepositDeclineAlert,
  sendWithdrawalRequestAlert, //withdrawal
  sendWithdrawalApprovedAlert,
  sendWithdrawalDeclinedAlert,
  sendIdVerifiedAlert, //kyc
  sendTranferAlert, //transfer
  sendSavingsCreatedAlert, //savings
  sendContributionAlert,
  sendCashoutRequestAlert,
};
