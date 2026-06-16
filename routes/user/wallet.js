const { Router } = require("express");
const {
  getUserWallets,
  getWalletAnalytics,
  getAccountsInvestmentData,
  getPortfolioAccounts,
  getTradingAccounts,
  getUserNetworth,
} = require("../../handlers/user/walletController");

const router = Router();

router.route("/").get(getUserWallets);
router.route("/analytics").get(getWalletAnalytics);
router.route("/networth").get(getUserNetworth);
router.route("/portfolio-accounts").get(getPortfolioAccounts);
router.route("/trading-accounts").get(getTradingAccounts);
router.route("/invest-data").get(getAccountsInvestmentData);

module.exports = router;
