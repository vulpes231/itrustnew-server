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
      try {
        switch (emailData.type) {
          case "AUTH_CODE_EMAIL":
            const authResult = await emailService.sendLoginCode(emailData.to);
            break;
          case "VERIFICATION_EMAIL":
            const result = await emailService.sendMailVerificationCode(
              emailData.subject,
              emailData.to,
            );
            break;
          case "DEPOSIT_EMAIL":
            await emailService.sendDepositAlert(
              emailData.to,
              emailData.templateData.amount,
              emailData.templateData.paymentMethod,
              emailData.templateData.currency,
            );
            break;

          case "WELCOME_EMAIL":
            await emailService.sendWelcomeMessage(
              emailData.to,
              emailData.templateData.name,
            );
            break;

          default:
            console.warn("Unknown email type:", emailData.type);
            break;
        }

        queueService.channel.ack(msg);
      } catch (error) {
        console.error("Worker error:", error.message);

        const isSafeToRetry = isRetryableError(error);

        if (isSafeToRetry) {
          queueService.channel.nack(msg, false, true);
        } else {
          console.warn("Dropping message (non-retryable)");
          queueService.channel.nack(msg, false, false);
          throw error;
        }
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
