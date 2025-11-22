const amqp = require("amqplib");

class QueueService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queues = new Map();
    this.isConnected = false;
    this.reconnectDelay = 5000;
  }

  async connect() {
    if (this.isConnected) return;

    try {
      console.log("Connecting to RabbitMQ...");
      this.connection = await amqp.connect(process.env.RABBITMQ_URL, {
        heartbeat: 30,
      });

      this.connection.on("error", (err) => {
        console.error("RabbitMQ connection error:", err.message);
      });

      this.connection.on("close", () => {
        console.warn("RabbitMQ connection closed. Reconnecting...");
        this.isConnected = false;
        setTimeout(() => this.connect(), this.reconnectDelay);
      });

      this.channel = await this.connection.createChannel();

      this.channel.on("error", (err) => {
        console.error("RabbitMQ channel error:", err.message);
      });

      this.channel.on("close", () => {
        console.warn("RabbitMQ channel closed. Reopening...");
        this.isConnected = false;
        setTimeout(() => this.connect(), this.reconnectDelay);
      });

      this.isConnected = true;
      console.log("RabbitMQ connected");

      for (const q of this.queues.keys()) {
        await this.channel.assertQueue(q, { durable: true });
      }
    } catch (err) {
      console.error("RabbitMQ connection failed:", err.message);
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  async assertQueue(queueName, options = { durable: true }) {
    if (!this.isConnected) await this.connect();

    if (!this.queues.has(queueName)) {
      await this.channel.assertQueue(queueName, options);
      this.queues.set(queueName, true);
    }
  }

  async sendToQueue(queueName, message, options = { persistent: true }) {
    await this.assertQueue(queueName);

    try {
      const ok = this.channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message)),
        options
      );

      if (!ok) {
        console.warn("sendToQueue buffer full — waiting for drain");
        await new Promise((resolve) => this.channel.once("drain", resolve));
      }

      return true;
    } catch (err) {
      console.error(`Error sending to queue ${queueName}:`, err.message);
      console.warn("Retrying send after reconnect...");
      this.isConnected = false;
      await this.connect();
      return this.sendToQueue(queueName, message);
    }
  }

  async consume(queueName, callback, options = {}) {
    await this.assertQueue(queueName);

    await this.channel.consume(
      queueName,
      async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          this.channel.ack(msg);
        } catch (err) {
          console.error(`Processing error for ${queueName}:`, err.message);
          this.channel.nack(msg, false, true);
        }
      },
      options
    );
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      console.log("RabbitMQ shutdown clean");
    } catch (err) {
      console.error("Error while closing RabbitMQ:", err.message);
    }
  }
}

module.exports = new QueueService();
