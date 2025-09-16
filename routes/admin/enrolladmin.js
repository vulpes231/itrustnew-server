const { Router } = require("express");
const {
	enrollAdmin,
	enrollSU,
} = require("../../handlers/admin/enrollAdminHandler");
const { verifySuperUser } = require("../../middlewares/verifyRole");

const router = Router();

router.route("/").post(enrollAdmin, verifySuperUser);
// router.route("/su").post(enrollSU);

module.exports = router;
