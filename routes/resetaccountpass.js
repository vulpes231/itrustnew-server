const { Router } = require("express");

const {
  sendPassResetOtp,
  confirmPassResetOtp,
  updateAccountPass,
} = require("../handlers/resetAccountPassController");
const { verifyResetToken } = require("../middlewares/verifyJWT");

const router = Router();

router.route("/otp").post(sendPassResetOtp);
router.route("/confirm").put(confirmPassResetOtp);
router.route("/").patch(verifyResetToken, updateAccountPass);

module.exports = router;
