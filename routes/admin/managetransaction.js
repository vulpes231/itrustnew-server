const { Router } = require("express");
const {
	getAllTransactions,
	updateTransaction,
	getTransactionData,
} = require("../../handlers/admin/manageTransactionController");

const router = Router();

router.route("/").get(getAllTransactions);
router.route("/:transactionId").get(getTransactionData).put(updateTransaction);

module.exports = router;
