const { Router } = require("express");
const {
	getAdmins,
	getAdminInfo,
	removeAdmin,
	updateRole,
} = require("../../handlers/admin/manageAdminHandler");
const { requireRole } = require("../../middlewares/requireRole");
const { ROLES } = require("../../utils/utils");

const router = Router();

router
	.route("/")
	.get(requireRole([ROLES.ADMIN, ROLES.SUPER_USER]), getAdminInfo) // any admin can view info
	.put(requireRole([ROLES.SUPER_USER]), updateRole)
	.delete(requireRole([ROLES.SUPER_USER]), removeAdmin); // only superuser

router
	.route("/all")
	.get(requireRole([ROLES.ADMIN, ROLES.SUPER_USER]), getAdmins);

module.exports = router;
