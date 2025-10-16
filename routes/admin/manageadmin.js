const { Router } = require("express");
const {
	getAdmins,
	getAdminInfo,
	removeAdmin,
	updateRole,
	logoutAdminSession,
} = require("../../handlers/admin/manageAdminHandler");
const { requireRole } = require("../../middlewares/requireRole");
const { ROLES } = require("../../utils/utils");

const router = Router();

router
	.route("/")
	.get(requireRole([ROLES.ADMIN, ROLES.SUPER_USER]), getAdminInfo)
	.put(requireRole([ROLES.SUPER_USER]), updateRole)
	.delete(requireRole([ROLES.SUPER_USER]), removeAdmin);
router
	.route("/logout")
	.put(requireRole([ROLES.ADMIN, ROLES.SUPER_USER]), logoutAdminSession);
router
	.route("/all")
	.get(requireRole([ROLES.ADMIN, ROLES.SUPER_USER]), getAdmins);

module.exports = router;
