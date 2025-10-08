const { Router } = require("express");

const {
	adminGetUserWallets,
} = require("../../handlers/admin/manageWalletHandler");

const router = Router();

router.route("/:userId").get(adminGetUserWallets);

module.exports = router;
