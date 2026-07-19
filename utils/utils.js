require("dotenv").config();
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { default: mongoose } = require("mongoose");
const { default: axios } = require("axios");
const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

async function waitForDatabaseConnection(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const state = mongoose.connection.readyState;
    if (state === 1) {
      console.log("✅ Database connection verified");
      return true;
    }
    console.log(
      `Waiting for database connection... (${i + 1}/${maxAttempts}) Current state: ${state}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Database connection timeout after 30 seconds");
}

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

function getPositionValue(position) {
  return (
    (position.performance?.totalReturn || 0) +
    (position.performance?.extra || 0)
  );
}

function transformStock(symbol, quoteData, profileData, metricsData) {
  if (!quoteData) return null;

  const asset = {
    symbol: symbol,
    name: profileData?.companyName || quoteData.name || symbol,
    type: "stock",
    exchange: mapExchange(quoteData.exchange || profileData?.exchange),
    priceData: {
      current: quoteData.price || 0,
      open: quoteData.open || null,
      previousClose: quoteData.previousClose || null,
      dayLow: quoteData.dayLow || null,
      dayHigh: quoteData.dayHigh || null,
      change: quoteData.change || null,
      changePercent: quoteData.changesPercentage || null,
      volume: quoteData.volume || null,
      avgVolume: quoteData.avgVolume || null,
    },
    historical: {
      yearLow: quoteData.yearLow || null,
      yearHigh: quoteData.yearHigh || null,
    },
    fundamentals: {
      marketCap: quoteData.marketCap || profileData?.mktCap || null,
      eps: metricsData?.eps || profileData?.eps || null,
      pe: quoteData.pe || metricsData?.peRatio || null,
      dividendYield: profileData?.lastDividendValue || null,
    },
    imageUrl: profileData?.image || null,
    isActive: true,
    isTradable: true,
    lastUpdated: new Date(),
    apiId: symbol,
  };

  return asset;
}

function transformToETFAsset(symbol, quoteData, profileData, etfInfo) {
  if (!quoteData) return null;

  const asset = {
    symbol: symbol,
    name: profileData?.companyName || quoteData.name || symbol,
    type: "etf",
    exchange: mapExchange(quoteData.exchange || profileData?.exchange),
    priceData: {
      current: quoteData.price || 0,
      open: quoteData.open || null,
      previousClose: quoteData.previousClose || null,
      dayLow: quoteData.dayLow || null,
      dayHigh: quoteData.dayHigh || null,
      change: quoteData.change || null,
      changePercent: quoteData.changesPercentage || null,
      volume: quoteData.volume || null,
      avgVolume: quoteData.avgVolume || null,
    },
    historical: {
      yearLow: quoteData.yearLow || null,
      yearHigh: quoteData.yearHigh || null,
    },
    fundamentals: {
      marketCap: quoteData.marketCap || profileData?.mktCap || null,
      eps: null,
      pe: null,
      dividendYield: profileData?.lastDividendValue || null,
    },
    imageUrl: profileData?.image || null,
    isActive: true,
    isTradable: true,
    lastUpdated: new Date(),
    apiId: symbol,
  };

  return asset;
}

function transformCrypto(symbol, quoteData) {
  return {
    symbol,
    name: quoteData.name,
    type: "crypto",
    exchange: mapExchange(quoteData.exchange),

    priceData: {
      current: quoteData.price,
      open: quoteData.open,
      previousClose: quoteData.previousClose,
      dayLow: quoteData.dayLow,
      dayHigh: quoteData.dayHigh,
      change: quoteData.change,
      changePercent: quoteData.changesPercentage,
      volume: quoteData.volume,
      avgVolume: quoteData.avgVolume,
    },

    historical: {
      yearLow: quoteData.yearLow,
      yearHigh: quoteData.yearHigh,
    },

    fundamentals: {
      marketCap: quoteData.marketCap,
      eps: null,
      pe: null,
      dividendYield: null,
    },

    imageUrl: quoteData.image || null,
    isActive: true,
    isTradable: true,
    lastUpdated: new Date(),
    apiId: symbol,
  };
}

async function fetchQuote(symbol) {
  try {
    const response = await axios.get(`${FMP_BASE_URL}/quote/${symbol}`, {
      params: {
        apikey: FMP_API_KEY,
      },
    });

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error.message);
    return null;
  }
}

async function fetchProfile(symbol) {
  try {
    const response = await axios.get(`${FMP_BASE_URL}/profile/${symbol}`, {
      params: {
        apikey: FMP_API_KEY,
      },
    });

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching profile for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch key metrics (PE, EPS, etc.)
 */
async function fetchKeyMetrics(symbol) {
  try {
    const response = await axios.get(
      `${FMP_BASE_URL}/key-metrics-ttm/${symbol}`,
      {
        params: {
          apikey: FMP_API_KEY,
        },
      },
    );

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching metrics for ${symbol}:`, error.message);
    return null;
  }
}

module.exports = {
  getPositionValue,
  fetchProfile,
  fetchKeyMetrics,
  fetchQuote,
  getClientIp,
  generateOtp,
  CustomError,
  ROLES,
  generateFileName,
  getDurationInMs,
  upload,
  allowedMimeTypes,
  waitForDatabaseConnection,
  transformStock,
  transformToETFAsset,
  transformCrypto,
};
