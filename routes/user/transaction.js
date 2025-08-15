const { Router } = require("express");
const {
	getTransactionHistory,
	stopTransaction,
	deposit,
	withdraw,
	transfer,
} = require("../../handlers/user/transactionController");

const router = Router();

router.router("/").get(getTransactionHistory).put(stopTransaction);
router.router("/deposit").post(deposit);
router.router("/withdraw").post(withdraw);
router.router("/transfer").post(transfer);

module.exports = router;
