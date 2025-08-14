const { Router } = require("express");
const { getUserWallets } = require("../../handlers/user/walletController");

const router = Router();

router.router("/").get(getUserWallets);

module.exports = router;
