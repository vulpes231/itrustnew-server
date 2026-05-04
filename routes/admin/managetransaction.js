const { Router } = require("express");
const {
  getAllTransactions,
  updateTransaction,
  getTransactionData,
  adminCreateTransaction,
  setTransactionStatus,
} = require("../../handlers/admin/manageTransactionController");

const router = Router();

router.route("/").get(getAllTransactions).post(adminCreateTransaction);
router
  .route("/:transactionId")
  .get(getTransactionData)
  .put(updateTransaction)
  .patch(setTransactionStatus);

module.exports = router;
