const { Router } = require("express");
const {
	elevateAdmin,
	deElevateAdmin,
	getAdmins,
	getAdminInfo,
	removeAdmin,
} = require("../../handlers/admin/manageAdminHandler");
const { requireRole } = require("../../middlewares/requireRole");
const { ROLES } = require("../../utils/utils");

const router = Router();

router
	.route("/")
	.get(requireRole([ROLES.ADMIN, ROLES.SUPER_USER]), getAdminInfo) // any admin can view info
	.post(requireRole([ROLES.SUPER_USER]), elevateAdmin) // only superuser
	.put(requireRole([ROLES.SUPER_USER]), deElevateAdmin) // only superuser
	.delete(requireRole([ROLES.SUPER_USER]), removeAdmin); // only superuser

router
	.route("/all")
	.get(requireRole([ROLES.ADMIN, ROLES.SUPER_USER]), getAdmins);

module.exports = router;
