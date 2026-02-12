const { Router } = require("express");
const {
  createSettings,
  updateLimits,
  updateBank,
  updateWallet,
} = require("../../handlers/admin/manageSettingsHandler");

const router = Router();

router.route("/").post(createSettings);
router.route("/bank").patch(updateBank);
router.route("/wallet").patch(updateWallet);
router.route("/limit").patch(updateLimits);

module.exports = router;
