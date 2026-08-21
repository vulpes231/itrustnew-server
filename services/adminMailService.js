require("dotenv").config();
const { sendMail } = require("../utils/mailer");
const {
  buildNewAccountAlert,
} = require("../utils/messages/admin/newAccountAlert");
const {
  buildNewAddressDocAlert,
} = require("../utils/messages/admin/newAddressDocAlert");
const {
  buildNewDepositAlert,
} = require("../utils/messages/admin/newDepositAlert");
const {
  buildNewIdUploadAlert,
} = require("../utils/messages/admin/newIdentityUploadAlert");
const { buildNewTradeAlert } = require("../utils/messages/admin/newTradeAlert");
const {
  buildNewTransferAlert,
} = require("../utils/messages/admin/newTransferAlert");
const {
  buildNewWithdrawAlert,
} = require("../utils/messages/admin/newWithdrawAlert");
const { CustomError } = require("../utils/utils");

class AdminMailService {
  async sendNewUserAlert(username) {
    const email = process.env.ADMIN_EMAIL;
    const subject = "New Account Added";
    const msg = buildNewAccountAlert(username);
    try {
      await sendMail(email, subject, msg);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(error.message, 500);
    }
  }

  async sendNewDepositAlert(user, transaction) {
    const email = process.env.ADMIN_EMAIL;
    const subject = "Deposit Requested";
    const msg = buildNewDepositAlert({ user, transaction });
    try {
      await sendMail(email, subject, msg);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(error.message, 500);
    }
  }

  async sendNewWithdrawalAlert(user, transaction) {
    const email = process.env.ADMIN_EMAIL;
    const subject = "Withdrawal Requested";
    const msg = buildNewWithdrawAlert({ user, transaction });
    try {
      await sendMail(email, subject, msg);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(error.message, 500);
    }
  }

  async sendNewTransferAlert(user, transaction) {
    const email = process.env.ADMIN_EMAIL;
    const subject = "Transfer Alert";
    const msg = buildNewTransferAlert({ user, transaction });
    try {
      await sendMail(email, subject, msg);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(error.message, 500);
    }
  }

  async sendNewTradeAlert(user, trade) {
    const email = process.env.ADMIN_EMAIL;
    const subject = "New Order Alert";
    const msg = buildNewTradeAlert({ user, trade });
    try {
      await sendMail(email, subject, msg);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(error.message, 500);
    }
  }

  async sendIdUploadAlert(username) {
    const email = process.env.ADMIN_EMAIL;
    const subject = "Identity Document Submission";
    const msg = buildNewIdUploadAlert(username);
    try {
      await sendMail(email, subject, msg);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(error.message, 500);
    }
  }

  async sendPOFUploadAlert(username) {
    const email = process.env.ADMIN_EMAIL;
    const subject = "Proof Of Address Document Submission";
    const msg = buildNewAddressDocAlert(username);
    try {
      await sendMail(email, subject, msg);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(error.message, 500);
    }
  }
}

module.exports = new AdminMailService();
