const { Router } = require("express");
const { registerUser } = require("../../handlers/user/authController");
const registerRateLimit = require("../../middlewares/rateLimit");

const router = Router();

router.route("/").post(registerRateLimit, registerUser);

module.exports = router;
