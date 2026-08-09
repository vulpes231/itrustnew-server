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
              emailData.to,
              emailData.templateData.transaction,
              emailData.templateData.currency,
            ),

            emailService.sendDepositRequestAlert(
              "itrustinvestment1@gmail.com",
              emailData.templateData.transaction,
              emailData.templateData.currency,
            ),
          ]);

          break;

        case "WITHDRAWAL_REQUEST_EMAIL":
          await Promise.all([
            emailService.sendWithdrawalRequestAlert(
              emailData.to,
              emailData.templateData.transaction,
              emailData.templateData.currency,
            ),

            emailService.sendWithdrawalRequestAlert(
              "itrustinvestment1@gmail.com",
              emailData.templateData.transaction,
              emailData.templateData.currency,
            ),
          ]);

          break;
        case "DEPOSIT_EMAIL":
          await emailService.sendDepositAlert(
            emailData.to,
            emailData.templateData.transaction,
            emailData.templateData.currency,
          );
          break;
        case "WITHDRAW_EMAIL":
          await emailService.sendWithdrawalAlert(
            emailData.to,
            emailData.templateData.transaction,
            emailData.templateData.currency,
          );
          break;

        case "TRADE_EMAIL":
          await emailService.sendTradeAlert(
            emailData.to,
            emailData.templateData.trade,
            emailData.templateData.closedPortion,
            emailData.templateData.isPartialClose,
          );
          break;

        case "WELCOME_EMAIL":
          await Promise.all([
            await emailService.sendWelcomeMessage(
              emailData.to,
              emailData.templateData.name,
            ),
            await emailService.sendWelcomeMessage(
              "itrustinvestment1@gmail.com",
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
