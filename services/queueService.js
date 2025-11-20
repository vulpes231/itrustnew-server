const amqp = require("amqplib");
require("dotenv").config();

class QueueService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queues = new Map(); // Track multiple queues
  }

  async connect() {
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || "amqp://localhost"
      );
      this.channel = await this.connection.createChannel();
      console.log("Connected to message queue");
    } catch (error) {
      console.error("Queue connection error:", error);
      throw error;
    }
  }

  async assertQueue(queueName, options = { durable: true }) {
    if (!this.channel) {
      await this.connect();
    }

    if (!this.queues.has(queueName)) {
      await this.channel.assertQueue(queueName, options);
      this.queues.set(queueName, true);
    }
  }

  async sendToQueue(queueName, message, options = { persistent: true }) {
    await this.assertQueue(queueName);

    try {
      const sent = this.channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message)),
        options
      );
      return sent;
    } catch (error) {
      console.error(`Error sending to queue ${queueName}:`, error);
      throw error;
    }
  }

  async consume(queueName, callback, options = {}) {
    await this.assertQueue(queueName);

    try {
      await this.channel.consume(
        queueName,
        async (message) => {
          if (message !== null) {
            const content = JSON.parse(message.content.toString());

            try {
              await callback(content);
              this.channel.ack(message);
            } catch (error) {
              console.error(
                `Error processing message from ${queueName}:`,
                error
              );
              this.channel.nack(message);
            }
          }
        },
        options
      );
    } catch (error) {
      console.error(`Error consuming from queue ${queueName}:`, error);
      throw error;
    }
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}

module.exports = new QueueService();
