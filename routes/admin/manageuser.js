const { Router } = require("express");
const {
	getAllUsers,
	reviewVerification,
	suspendAccount,
	removeUser,
} = require("../../handlers/admin/manageUserHandler");

const router = Router();

router.route("/").get(getAllUsers);
router
	.route("/:userId")
	.post(reviewVerification)
	.put(suspendAccount)
	.delete(removeUser);

module.exports = router;
