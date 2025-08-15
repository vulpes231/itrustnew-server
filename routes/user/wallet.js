const { Router } = require("express");
const {
	getUserWallets,
	getWalletAnalytics,
} = require("../../handlers/user/walletController");

const router = Router();

router.route("/").get(getUserWallets);
router.route("/analytics").get(getWalletAnalytics);

module.exports = router;
