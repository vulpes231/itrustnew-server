// routes/portfolio.js
const express = require("express");
const router = express.Router();

const {
  recordFundDeposit,
  getUserPortfolioValue,
  getPortfolioChartData,
  getDashChartData,
  getAllPortfolioChartData,
} = require("../../handlers/user/portfolioController");

router.get("/dashboard/:timeframe", getDashChartData);
router.get("/portfolio/all", getAllPortfolioChartData);
router.get("/portfolio/:walletId", getPortfolioChartData);

router.get("/current-value", getUserPortfolioValue);
router.post("/record-deposit", recordFundDeposit);

module.exports = router;
