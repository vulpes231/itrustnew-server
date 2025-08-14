const { Router } = require("express");
const { registerUser } = require("../../handlers/user/authController");

const router = Router();

router.route("/").post(registerUser);

module.exports = router;
