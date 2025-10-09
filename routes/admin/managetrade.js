const { Router } = require("express");
const {
	getAllTrades,
	addNewTrade,
	exitTrade,
	updateTrade,
	getTradeInfo,
} = require("../../handlers/admin/manageTradeHandler");

const router = Router();

router.route("/").get(getAllTrades).post(addNewTrade);
router.route("/:tradeId").get(getTradeInfo).post(exitTrade).put(updateTrade);

module.exports = router;
