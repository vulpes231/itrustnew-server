const { Router } = require("express");
const {
	adminSignin,
	enrollAdmin,
} = require("../../handlers/admin/adminAuthHandler");
const { verifySuperUser } = require("../../middlewares/verifyRole");

const router = Router();

router.route("/login").post(adminSignin);
router.route("/register").post(enrollAdmin, verifySuperUser);

module.exports = router;
