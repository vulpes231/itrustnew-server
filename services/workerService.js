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
        "Email worker: RabbitMQ connection closed. Restarting consumer..."
      );
      this.restartConsumer();
    });

    queueService.channel?.on("close", () => {
      console.warn(
        "Email worker: RabbitMQ channel closed. Restarting consumer..."
      );
      this.restartConsumer();
    });
  }

  async restartConsumer() {
    if (!this.isConsuming) return;

    // Delay to allow reconnection
    setTimeout(() => {
      console.log("Email worker reconnecting to queue...");
      this.consumeEmails();
    }, 3000);
  }

  async consumeEmails() {
    await queueService.consume(this.queueName, async (emailData) => {
      try {
        console.log("Processing email:", emailData.type, "to:", emailData.to);

        switch (emailData.type) {
          case "VERIFICATION_EMAIL":
            await emailService.sendMailVerificationCode(emailData.to);
            break;

          case "WELCOME_EMAIL":
            await emailService.sendWelcomeMessage(
              emailData.to,
              emailData.templateData.name
            );
            break;

          default:
            console.warn("Unknown email type:", emailData.type);
            break;
        }

        console.log(`${emailData.type} sent successfully to:`, emailData.to);
      } catch (error) {
        console.error(`Failed to process email ${emailData.type}:`, error);
        throw error;
      }
    });
  }
}

module.exports = new EmailWorkerService();
