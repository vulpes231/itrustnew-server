const { Router } = require("express");
const { logoutUser } = require("../../handlers/user/authController");

const router = Router();

router.route("/").post(logoutUser);

module.exports = router;
