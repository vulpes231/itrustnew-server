const { Router } = require("express");
const { sendLoginOtp, sendMailOtp } = require("../handlers/mailcontroller");

const router = Router();
router.route("/loginotp").post(sendLoginOtp);
router.route("/emailotp").post(sendMailOtp);

module.exports = router;
