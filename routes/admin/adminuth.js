const { Router } = require("express");
const {
	adminSignin,
	enrollAdmin,
} = require("../../handlers/admin/adminAuthHandler");
const { verifyRole } = require("../../middlewares/verifyRole");

const router = Router();

router.route("/login").post(adminSignin);
router.route("/register").post(enrollAdmin, verifyRole);

module.exports = router;
