const { Router } = require("express");
const {
	elevateAdmin,
	deElevateAdmin,
	getAdmins,
	getAdminInfo,
	removeAdmin,
} = require("../../handlers/admin/manageAdminHandler");
const { verifySuperUser } = require("../../middlewares/verifyRole");

const router = Router();

router
	.route("/")
	.get(getAdminInfo)
	.post(elevateAdmin, verifySuperUser)
	.put(deElevateAdmin, verifySuperUser)
	.delete(removeAdmin, verifySuperUser);

router.route("/all").get(getAdmins);

module.exports = router;
