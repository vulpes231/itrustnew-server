const { Router } = require("express");
const {
	elevateAdmin,
	deElevateAdmin,
	getAdmins,
} = require("../../handlers/admin/manageAdminHandler");
const { verifySuperUser } = require("../../middlewares/verifyRole");

const router = Router();

router
	.route("/")
	.get(getAdmins)
	.post(elevateAdmin, verifySuperUser)
	.put(deElevateAdmin, verifySuperUser);

module.exports = router;
