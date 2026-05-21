const { Router } = require("express");
const {
  getAllTrades,
  addNewTrade,
  updateTrade,
  getTradeInfo,
  getAccountTrades,
  closeSingleOrder,
} = require("../../handlers/admin/manageTradeHandler");

const router = Router();

router.route("/").get(getAllTrades).post(addNewTrade);
router.route("/:userId").get(getAccountTrades);
router
  .route("/:tradeId")
  .get(getTradeInfo)
  .patch(updateTrade)
  .post(closeSingleOrder);

module.exports = router;
