// mailService.js
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
};

const validateEmailConfig = () => {
  const required = ["EMAIL_HOST", "EMAIL_ADDRESS", "EMAIL_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing email configuration: ${missing.join(", ")}`);
  }
};

const sendMail = async (email, subject, message, attachments = []) => {
  validateEmailConfig();

  const transporter = createTransporter();

  const mailOptions = {
    from: `"Itrust Investments" <${process.env.EMAIL_ADDRESS}>`,
    to: email,
    subject: subject,
    html: message,
    text: message.replace(/<[^>]*>/g, ""),
    attachments: attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);

    if (process.env.LOG_SUCCESSFUL_EMAILS === "true") {
      const logsDir = path.join(__dirname, "../logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      fs.appendFileSync(
        path.join(__dirname, "../logs/mailsuccess.txt"),
        `[${new Date().toISOString()}] Email sent to ${email}: ${subject} (MessageID: ${
          info.messageId
        })\n`
      );
    }

    return info;
  } catch (error) {
    console.error("Email sending failed:", error.message);
    console.error("Error code:", error.code);

    const logsDir = path.join(__dirname, "../logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const errorLog = {
      timestamp: new Date().toISOString(),
      to: email,
      subject: subject,
      error: error.message,
      code: error.code,
      stack: error.stack,
    };

    fs.appendFileSync(
      path.join(__dirname, "../logs/mailerror.txt"),
      `${JSON.stringify(errorLog)}\n`
    );

    throw error;
  }
};

module.exports = {
  sendMail,

  validateEmailConfig,
};
