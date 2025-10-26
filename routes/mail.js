const { Router } = require("express");
const {
	sendLoginOtp,
	sendMailOtp,
	sendTestMail,
} = require("../handlers/mailController");

const router = Router();
router.route("/testmail").post(sendTestMail);
router.route("/loginotp").post(sendLoginOtp);
router.route("/emailotp").post(sendMailOtp);

module.exports = router;
