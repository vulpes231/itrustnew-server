const { Router } = require("express");
const {
  createSettings,
  updateLimits,
  updateBank,
  updateWallet,
  getGlobalSettingByAdmin,
} = require("../../handlers/admin/manageSettingsHandler");

const router = Router();

router.route("/").get(getGlobalSettingByAdmin).post(createSettings);
router.route("/bank").patch(updateBank);
router.route("/wallet").patch(updateWallet);
router.route("/limit").patch(updateLimits);

module.exports = router;
