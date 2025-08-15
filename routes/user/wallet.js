const { Router } = require("express");
const { getUserWallets } = require("../../handlers/user/walletController");

const router = Router();

router.route("/").get(getUserWallets);

module.exports = router;
