const { Router } = require("express");

const {
  adminGetUserWallets,
  editWalletBalance,
} = require("../../handlers/admin/manageWalletHandler");

const router = Router();

router.route("/").patch(editWalletBalance);

router.route("/:userId").get(adminGetUserWallets);

module.exports = router;
