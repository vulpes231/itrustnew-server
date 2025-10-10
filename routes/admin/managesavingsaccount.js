const { Router } = require("express");
const {
	adminCreateSavings,
	adminEditSavings,
	adminDeleteSavings,
} = require("../../handlers/admin/manageSavingsAccountHandler");

const router = Router();

router.route("/").post(adminCreateSavings);
router.route("/:accountId").put(adminEditSavings).delete(adminDeleteSavings);

module.exports = router;
