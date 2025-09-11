const { Router } = require("express");
const {
	getAllUsers,
	reviewVerification,
	suspendAccount,
} = require("../../handlers/admin/manageUserHandler");

const router = Router();

router.route("/").get(getAllUsers);
router.route("/:userId").post(reviewVerification).put(suspendAccount);

module.exports = router;
