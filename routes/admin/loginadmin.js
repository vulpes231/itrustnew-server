const { Router } = require("express");
const { adminSignin } = require("../../handlers/admin/loginAdminHandler");

const router = Router();

router.route("/").post(adminSignin);

module.exports = router;
