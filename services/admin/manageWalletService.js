const { Router } = require("express");
const { ROLES } = require("../../utils/utils");
const { requireRole } = require("../../middlewares/requireRole");
const {
  adminGetUserWallets,
} = require("../../handlers/admin/manageWalletHandler");

const router = Router();

router
  .route("/:userId")
  .get(requireRole([ROLES.ADMIN, ROLES.SUPER_USER], adminGetUserWallets));

module.exports = router;
