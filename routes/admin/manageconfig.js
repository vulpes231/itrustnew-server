const { Router } = require("express");
const {
  updateUserLimits,
  updateBankInfo,
  updateCryptoInfo,
  userConfigUpdate,
} = require("../../handlers/admin/manageUserConfigHandler");

const router = Router();

router.route("/").patch(updateUserLimits);
router.route("/bank").patch(updateBankInfo);
router.route("/crypto").patch(updateCryptoInfo);
router.route("/user").patch(userConfigUpdate);

module.exports = router;
