const { Router } = require("express");
const {
  openPosition,
  closePosition,
  getUserTrades,
  getTradeInsight,
} = require("../../handlers/user/tradeController");

const router = Router();

router.route("/").get(getUserTrades).post(openPosition).put(closePosition);
router.route("/analytics").get(getTradeInsight);

module.exports = router;
