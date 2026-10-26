const { Router } = require("express");
const {
  openPosition,
  closePosition,
  getUserTrades,
  getTradeInsight,
  searchTrades,
  closeSingleTrade,
} = require("../../handlers/user/tradeController");

const router = Router();

router.route("/").get(getUserTrades).post(openPosition).patch(closeSingleTrade);
router.route("/search").get(searchTrades);
router.route("/sell").post(closePosition);
router.route("/analytics").get(getTradeInsight);

module.exports = router;
