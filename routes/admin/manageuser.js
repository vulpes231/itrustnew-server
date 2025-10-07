const { Router } = require("express");
const {
	getAllUsers,
	reviewVerification,
	suspendAccount,
	removeUser,
	getUser,
} = require("../../handlers/admin/manageUserHandler");

const router = Router();

router.route("/").get(getAllUsers);
router
	.route("/:userId")
	.get(getUser)
	.post(reviewVerification)
	.put(suspendAccount)
	.delete(removeUser);

module.exports = router;
