// test-queue.js
require("dotenv").config();
const queueService = require("./services/queueService");
const emailWorker = require("./services/workerService");

async function testQueueEmail() {
  try {
    console.log("Starting queue test...");

    // Connect to RabbitMQ
    await queueService.connect();

    // Start worker
    await emailWorker.startEmailWorker();
    console.log("Worker started");

    // Wait a moment for worker to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Send test message to queue
    console.log("Sending test email to queue...");
    await queueService.sendToQueue("email_queue", {
      type: "VERIFICATION_EMAIL",
      to: "larou34@svk.jp",
    });

    console.log("Message sent to queue. Waiting for processing...");

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log("Test complete. Check logs above for details.");

    // Don't close immediately to allow processing
    // await queueService.close();
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testQueueEmail();
