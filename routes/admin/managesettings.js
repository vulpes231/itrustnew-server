const { Router } = require("express");
const {
  createSettings,
  updateLimits,
  updateBank,
  updateWallet,
} = require("../../handlers/admin/manageSettingsHandler");

const router = Router();

router.route("/").post(createSettings);
router.route("/bank").put(updateBank);
router.route("/wallet").put(updateWallet);
router.route("/limit").put(updateLimits);

module.exports = router;
