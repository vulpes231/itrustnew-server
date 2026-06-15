const { Router } = require("express");
const {
  getUserWallets,
  getWalletAnalytics,
  getAccountsInvestmentData,
  getPortfolioAccounts,
} = require("../../handlers/user/walletController");

const router = Router();

router.route("/").get(getUserWallets);
router.route("/analytics").get(getWalletAnalytics);
router.route("/portfolio-accounts").get(getPortfolioAccounts);
router.route("/invest-data").get(getAccountsInvestmentData);

module.exports = router;
