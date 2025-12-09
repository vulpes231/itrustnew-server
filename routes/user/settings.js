const { Router } = require("express");
const { getGlobalSettings } = require("../../handlers/user/settingsController");

const router = Router();

router.route("/").get(getGlobalSettings);

module.exports = router;
