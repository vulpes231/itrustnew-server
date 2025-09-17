const { Router } = require("express");
const {
	enrollAdmin,
	enrollSU,
} = require("../../handlers/admin/enrollAdminHandler");
const { requireRole } = require("../../middlewares/requireRole");
const { ROLES } = require("../../utils/utils");

const router = Router();

router.route("/").post(requireRole([ROLES.SUPER_USER]), enrollAdmin);
// router.route("/su").post(enrollSU);

module.exports = router;
