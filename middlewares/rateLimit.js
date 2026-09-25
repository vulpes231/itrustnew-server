const { redisClient } = require("../configs/redis");

const registerRateLimit = async (req, res, next) => {
  try {
    const ip = req.ip;
    const email = req.body?.email?.trim().toLowerCase();

    const ipKey = `rate-limit:register:ip:${ip}`;

    const ipAttempts = await redisClient.incr(ipKey);

    if (ipAttempts === 1) {
      await redisClient.expire(ipKey, 60 * 60);
    }

    if (ipAttempts > 3) {
      return res.status(429).json({
        message: "Too many registration attempts. Please try again later.",
      });
    }

    if (email) {
      const emailKey = `rate-limit:register:email:${email}`;

      const emailAttempts = await redisClient.incr(emailKey);

      if (emailAttempts === 1) {
        await redisClient.expire(emailKey, 60 * 60);
      }

      if (emailAttempts > 3) {
        return res.status(429).json({
          message:
            "Too many registration attempts for this email. Please try again later.",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Registration rate limiter error:", error);
    next();
  }
};

module.exports = registerRateLimit;
