// routes/portfolio.js
const express = require("express");
const router = express.Router();

const {
  recordFundDeposit,
  getUserPortfolioValue,
  getUserChartData,
} = require("../../handlers/user/portfolioController");

router.get("/:timeframe", getUserChartData);
router.get("/current-value", getUserPortfolioValue);
router.post("/record-deposit", recordFundDeposit);

module.exports = router;
