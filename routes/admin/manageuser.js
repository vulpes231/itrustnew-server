const { Router } = require("express");
const {
  getAllUsers,
  reviewVerification,
  suspendAccount,
  removeUser,
  getUser,
  connectWallet,
  getVerifyData,
} = require("../../handlers/admin/manageUserHandler");

const router = Router();

router.route("/").get(getAllUsers);
router.route("/verify-data/:userId").get(getVerifyData);
router
  .route("/:userId")
  .get(getUser)
  .post(reviewVerification)
  .patch(connectWallet)
  .put(suspendAccount)
  .delete(removeUser);

module.exports = router;
