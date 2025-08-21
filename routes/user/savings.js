const { Router } = require("express");
const {
	getSavingsAccounts,
	getSavingsHistory,
	createSavingsAccounts,
	cashoutSavings,
	contributeSavings,
} = require("../../handlers/user/savingsController");

const router = Router();

router.route("/").get(getSavingsAccounts).post(createSavingsAccounts);
router.route("/history").get(getSavingsHistory);
router.route("/contribute").get(contributeSavings);
router.route("/cashout").post(cashoutSavings);
