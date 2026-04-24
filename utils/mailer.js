// mailService.js
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    validateEmailConfig();

    transporter = nodemailer.createTransport({
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

      tls: {
        rejectUnauthorized: false, // Only for testing, remove in production
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    transporter.verify((error, success) => {
      if (error) {
        console.error("SMTP transporter verification failed:", error.message);
      } else {
        console.log("SMTP transporter ready to send emails");
      }
    });
  }

  return transporter;
};

const validateEmailConfig = () => {
  const required = ["EMAIL_HOST", "EMAIL_ADDRESS", "EMAIL_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing email configuration: ${missing.join(", ")}`);
  }

  console.log("Email config loaded:", {
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    user: process.env.EMAIL_ADDRESS,
    hasPassword: !!process.env.EMAIL_PASSWORD,
  });
};

const sendMail = async (email, subject, message, attachments = []) => {
  try {
    const transporter = getTransporter();

    await transporter.verify();

    const mailOptions = {
      from: `"Itrust Investments" <${process.env.EMAIL_ADDRESS}>`,
      to: email,
      subject: subject,
      html: message,
      text: message.replace(/<[^>]*>/g, ""),
      attachments: attachments,
    };

    console.log(`Sending email to ${email}...`);
    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);

    // Log success
    if (process.env.LOG_SUCCESSFUL_EMAILS === "true") {
      const logsDir = path.join(__dirname, "../logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      fs.appendFileSync(
        path.join(__dirname, "../logs/mailsuccess.txt"),
        `[${new Date().toISOString()}] Email sent to ${email}: ${subject} (MessageID: ${info.messageId})\n`,
      );
    }

    return info;
  } catch (error) {
    console.error("Email sending failed:", error.message);
    console.error("Error code:", error.code);
    console.error("Error command:", error.command);
    console.error("Response code:", error.responseCode);

    if (error.code === "EAUTH") {
      console.error(
        "Authentication failed! Check EMAIL_ADDRESS and EMAIL_PASSWORD",
      );
    } else if (error.code === "ECONNECTION") {
      console.error("Connection failed! Check EMAIL_HOST and network/firewall");
    }

    // Log error
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
      responseCode: error.responseCode,
      command: error.command,
    };

    fs.appendFileSync(
      path.join(__dirname, "../logs/mailerror.txt"),
      `${JSON.stringify(errorLog)}\n`,
    );

    throw error;
  }
};

const closeTransporter = async () => {
  if (transporter) {
    await transporter.close();
    transporter = null;
    console.log("📧 Email transporter closed");
  }
};

module.exports = {
  sendMail,
  validateEmailConfig,
  closeTransporter,
};
