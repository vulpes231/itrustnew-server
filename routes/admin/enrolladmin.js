const { Router } = require("express");
const { enrollAdmin } = require("../../handlers/admin/enrollAdminHandler");
const { verifySuperUser } = require("../../middlewares/verifyRole");

const router = Router();

router.route("/").post(enrollAdmin, verifySuperUser);

module.exports = router;
