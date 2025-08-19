const { Router } = require("express");
const {
	openPosition,
	closePosition,
	getUserTrades,
} = require("../../handlers/user/tradeController");

const router = Router();

router.route("/").get(getUserTrades).post(openPosition).put(closePosition);

module.exports = router;
