const { Router } = require("express");
const {
  getVerifyData,
  failVerification,
  cancelVerification,
} = require("../../handlers/admin/manageUserHandler");

const router = Router();

router
  .route("/:userId")
  .get(getVerifyData)
  .patch(failVerification)
  .post(cancelVerification);

module.exports = router;
