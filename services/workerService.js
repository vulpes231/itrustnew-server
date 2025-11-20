const emailService = require("./mailService");
const queueService = require("./queueService");

class EmailWorkerService {
  async startEmailWorker() {
    console.log("Starting email worker...");

    await queueService.consume("email_queue", async (emailData) => {
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
        console.error(`Failed to send ${emailData.type} email:`, error);
        throw error;
      }
    });
  }
}

module.exports = new EmailWorkerService();
