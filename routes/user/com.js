const { Router } = require("express");
const {
  sendChangeOfEmailCode,
  verifyChangeOfEmailCode,
} = require("../../handlers/user/verifyController");

const router = Router();

router.route("/verify").post(verifyChangeOfEmailCode);
router.route("/send").post(sendChangeOfEmailCode);

module.exports = router;
