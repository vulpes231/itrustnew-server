const { Router } = require("express");
const {
  getTransactionHistory,
  stopTransaction,
  deposit,
  withdraw,
  transfer,
  getTransactionAnalytics,
} = require("../../handlers/user/transactionController");
const { upload } = require("../../utils/utils");

const router = Router();

router.route("/").get(getTransactionHistory).put(stopTransaction);
router.route("/analytics").get(getTransactionAnalytics);
router.route("/deposit").post(upload.single("proof"), deposit);
router.route("/withdraw").post(withdraw);
router.route("/transfer").post(transfer);
router.route("/cancel").post(stopTransaction);

module.exports = router;
