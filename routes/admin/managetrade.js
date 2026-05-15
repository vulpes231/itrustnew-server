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

router.route("/").get(getAllTrades).post(addNewTrade);
router.route("/:userId").get(getAccountTrades);
router.route("/:tradeId").get(getTradeInfo).patch(updateTrade);

module.exports = router;
