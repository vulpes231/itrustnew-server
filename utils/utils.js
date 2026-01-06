require("dotenv").config();
const crypto = require("crypto");
const path = require("path");

const getClientIp = (req) => {
  // Destructure from headers first (for proxy servers)
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    req.connection.remoteAddress;

  // Handle IPv6 format (::ffff:192.168.1.1 → 192.168.1.1)
  return ip.includes("::") ? ip.split(":").pop() : ip;
};

function generateOtp(length = 4) {
  const numbers = "0123456789"; // Include 0 as well
  let otp = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * numbers.length);
    otp += numbers[randomIndex];
  }

  return otp;
}

class CustomError extends Error {
  constructor(message, code = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

const ROLES = {
  ADMIN: process.env.ADMIN_CODE,
  SUPER_USER: process.env.SUPER_USER_CODE,
};

const generateFileName = (originalName, type, userId) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalName);
  return `${userId}_${type}_${timestamp}_${randomString}${ext}`;
};

function getDurationInMs(milestone, duration) {
  const day = 24 * 60 * 60 * 1000;

  switch (duration) {
    case "day":
      return milestone * day;
    case "week":
      return milestone * 7 * day;
    case "month":
      return milestone * 30 * day;
    case "year":
      return milestone * 365 * day;
    default:
      throw new Error("Invalid duration type");
  }
}

module.exports = {
  getClientIp,
  generateOtp,
  CustomError,
  ROLES,
  generateFileName,
  getDurationInMs,
};
