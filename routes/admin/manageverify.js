const { Router } = require("express");
const { getVerifyData } = require("../../handlers/admin/manageUserHandler");

const router = Router();

router.route("/:userId").get(getVerifyData);

module.exports = router;
