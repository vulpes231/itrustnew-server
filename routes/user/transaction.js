const { Router } = require("express");
const {
	getTransactionHistory,
	stopTransaction,
	deposit,
	withdraw,
	transfer,
} = require("../../handlers/user/transactionController");

const router = Router();

router.route("/").get(getTransactionHistory).put(stopTransaction);
router.route("/deposit").post(deposit);
router.route("/withdraw").post(withdraw);
router.route("/transfer").post(transfer);

module.exports = router;
