const { Router } = require("express");
const {
  submitDetails,
  verifyAddress,
} = require("../../handlers/user/verifyController");
const { upload } = require("../../utils/utils");

const router = Router();

router.route("/").post(upload.array("idImages", 2), submitDetails);
router.route("/address-proof").post(upload.array("proof", 1), verifyAddress);

module.exports = router;
