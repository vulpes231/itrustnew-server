const { Router } = require("express");
const {
  getSavingsAccounts,
  getSavingsHistory,
  createSavingsAccounts,
  cashoutSavings,
  contributeSavings,
  getSavingAnalytics,
  removeUserSavingsAccounts,
} = require("../../handlers/user/savingsController");

const router = Router();

router.route("/").get(getSavingsAccounts).post(createSavingsAccounts);
router.route("/analytics").get(getSavingAnalytics);
router.route("/history").get(getSavingsHistory);
router.route("/contribute").post(contributeSavings);
router.route("/cashout").post(cashoutSavings);
router.route("/:accountId").delete(removeUserSavingsAccounts);

module.exports = router;
