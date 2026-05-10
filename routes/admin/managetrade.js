const { Router } = require("express");
const {
  getAllTrades,
  addNewTrade,
  exitTrade,
  updateTrade,
  getTradeInfo,
  getAccountTrades,
} = require("../../handlers/admin/manageTradeHandler");

const router = Router();

router.route("/").get(getAllTrades).post(addNewTrade).put(updateTrade);
router.route("/:userId").get(getAccountTrades);
router.route("/:tradeId").get(getTradeInfo).post(exitTrade);

module.exports = router;
