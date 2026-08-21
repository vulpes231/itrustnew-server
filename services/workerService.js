const adminMailService = require("./adminMailService");
const emailService = require("./mailService");
const queueService = require("./queueService");

class EmailWorkerService {
  constructor() {
    this.queueName = "email_queue";
    this.isConsuming = false;
  }

  async startEmailWorker() {
    if (this.isConsuming) {
      console.log("Email worker already running");
      return;
    }

    console.log("Starting email worker...");
    this.isConsuming = true;

    await this.consumeEmails();

    queueService.connection?.on("close", () => {
      console.warn(
        "Email worker: RabbitMQ connection closed. Restarting consumer...",
      );
      this.restartConsumer();
    });

    queueService.channel?.on("close", () => {
      console.warn(
        "Email worker: RabbitMQ channel closed. Restarting consumer...",
      );
      this.restartConsumer();
    });
  }

  async restartConsumer() {
    if (!this.isConsuming) return;

    setTimeout(() => {
      console.log("Email worker reconnecting to queue...");
      this.consumeEmails();
    }, 3000);
  }

  async consumeEmails() {
    await queueService.consume(this.queueName, async (emailData, msg) => {
      switch (emailData.type) {
        case "AUTH_CODE_EMAIL":
          await emailService.sendLoginCode(emailData.to);
          break;
        case "VERIFICATION_EMAIL":
          await emailService.sendMailVerificationCode(
            emailData.subject,
            emailData.to,
          );
          break;
        case "DEPOSIT_REQUEST_EMAIL":
          await Promise.all([
            emailService.sendDepositRequestAlert(
              emailData.templateData.user,
              emailData.templateData.transaction,
              emailData.templateData.settings,
            ),

            adminMailService.sendNewDepositAlert(
              emailData.templateData.user,
              emailData.templateData.transaction,
            ),
          ]);

          break;
        case "DEPOSIT_APPROVED_EMAIL":
          await emailService.sendDepositApprovedAlert(
            emailData.templateData.user,
            emailData.templateData.transaction,
          );
          break;
        case "DEPOSIT_DECLINED_EMAIL":
          await emailService.sendDepositDeclineAlert(
            emailData.templateData.user,
            emailData.templateData.transaction,
          );
          break;

        case "WITHDRAWAL_REQUEST_EMAIL":
          await Promise.all([
            emailService.sendWithdrawalRequestAlert(
              emailData.templateData.user,
              emailData.templateData.transaction,
            ),

            adminMailService.sendNewWithdrawalAlert(
              emailData.templateData.user,
              emailData.templateData.transaction,
            ),
          ]);

          break;

        case "WITHDRAW_APPROVED_EMAIL":
          await emailService.sendWithdrawalApprovedAlert(
            emailData.templateData.user,
            emailData.templateData.transaction,
          );
          break;

        case "WITHDRAW_DECLINED_EMAIL":
          await emailService.sendWithdrawalDeclinedAlert(
            emailData.templateData.user,
            emailData.templateData.transaction,
          );
          break;

        case "BUY_ORDER_EMAIL":
          await Promise.all([
            emailService.sendBuyAlert(
              emailData.templateData.user,
              emailData.templateData.trade,
            ),
            adminMailService.sendNewTradeAlert(
              emailData.templateData.user,
              emailData.templateData.trade,
            ),
          ]);
          break;
        case "SELL_ORDER_EMAIL":
          await Promise.all([
            emailService.sendSellAlert(
              emailData.templateData.user,
              emailData.templateData.trade,
            ),
            adminMailService.sendNewTradeAlert(
              emailData.templateData.user,
              emailData.templateData.trade,
            ),
          ]);
          break;
        case "TRANSFER_EMAIL":
          await Promise.all([
            emailService.sendTranferAlert(
              emailData.templateData.user,
              emailData.templateData.transaction,
            ),
            adminMailService.sendNewTransferAlert(
              emailData.templateData.user,
              emailData.templateData.transaction,
            ),
          ]);
          break;

        case "IDENTITY_UPLOAD_EMAIL":
          await adminMailService.sendIdUploadAlert(
            emailData.templateData.username,
          );
          break;

        case "POA_UPLOAD_EMAIL":
          await adminMailService.sendPOFUploadAlert(
            emailData.templateData.username,
          );
          break;

        case "IDENTITY_VERIFIED_EMAIL":
          await emailService.sendIdVerifiedAlert(emailData.templateData.user);
          break;

        case "SAVINGS_CREATED_EMAIL":
          await emailService.sendSavingsCreatedAlert(
            emailData.templateData.user,
            emailData.templateData.account,
          );
          break;

        case "CONTRIBUTION_EMAIL":
          await emailService.sendContributionAlert(
            emailData.templateData.user,
            emailData.templateData.transaction,
          );
          break;

        case "CASHOUT_REQUEST_EMAIL":
          await emailService.sendCashoutRequestAlert(
            emailData.templateData.user,
            emailData.templateData.transaction,
          );
          break;

        case "WELCOME_EMAIL":
          await Promise.all([
            await emailService.sendWelcomeMessage(
              emailData.to,
              emailData.templateData.name,
            ),
            await adminMailService.sendNewUserAlert(
              emailData.templateData.name,
            ),
          ]);
          break;

        default:
          console.warn("Unknown email type:", emailData.type);
          break;
      }
    });
  }
}

function isRetryableError(error) {
  const retryableErrors = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"];

  return retryableErrors.some(
    (e) => error.message.includes(e) || error.code === e,
  );
}

module.exports = new EmailWorkerService();
