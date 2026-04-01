const { Router } = require("express");
const {
  getAllUsers,
  reviewVerification,
  suspendAccount,
  removeUser,
  getUser,
  connectWallet,
  getUserConfiguration,
  getVerifyData,
} = require("../../handlers/admin/manageUserHandler");

const router = Router();

router.route("/").get(getAllUsers);

router.route("/settings/:userId").get(getUserConfiguration);
router
  .route("/:userId")
  .get(getUser)
  .post(reviewVerification)
  .patch(connectWallet)
  .put(suspendAccount)
  .delete(removeUser);

router.route("/verify/:userId").get(getVerifyData);

module.exports = router;
