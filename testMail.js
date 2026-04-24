require("dotenv").config();
// const emailService = require("./mailService");
const emailService = require("./utils/mailer");
// sendMail
async function test() {
  try {
    await emailService.sendMail(
      "larou34@svk.jp", // Use a real email you can check
      "Test Email",
      "<h1>Test</h1><p>This is a test message</p>",
    );
    console.log("Test completed successfully");
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

test();
