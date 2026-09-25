require("dotenv").config();

const verifyTurnstile = async (token, remoteip) => {
  if (!token) {
    return false;
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip,
      }),
    },
  );

  const result = await response.json();

  return result.success;
};

module.exports = { verifyTurnstile };
