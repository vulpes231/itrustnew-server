const { Router } = require("express");
const {
	getWatchlist,
	addToWatchlist,
	removeFromWatchlist,
} = require("../../handlers/user/watchlistController");

const router = Router();

router
	.route("/")
	.get(getWatchlist)
	.post(addToWatchlist)
	.put(removeFromWatchlist);

module.exports = router;
