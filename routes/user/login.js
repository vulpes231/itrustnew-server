const { Router } = require("express");
const { loginUser } = require("../../handlers/user/authController");

const router = Router();

router.route("/").post(loginUser);

module.exports = router;
