const { Router } = require("express");
const {
	getTransactionHistory,
	stopTransaction,
	deposit,
	withdraw,
	transfer,
	getTransactionAnalytics,
} = require("../../handlers/user/transactionController");

const router = Router();

router.route("/").get(getTransactionHistory).put(stopTransaction);
router.route("/analytics").get(getTransactionAnalytics);
router.route("/deposit").post(deposit);
router.route("/withdraw").post(withdraw);
router.route("/transfer").post(transfer);

module.exports = router;
