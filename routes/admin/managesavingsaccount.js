const { Router } = require("express");
const {
	adminCreateSavings,
	adminEditSavings,
	adminDeleteSavings,
	getAllSavingsAccounts,
	getSavings,
} = require("../../handlers/admin/manageSavingsAccountHandler");

const router = Router();

router.route("/").get(getAllSavingsAccounts).post(adminCreateSavings);
router
	.route("/:accountId")
	.get(getSavings)
	.put(adminEditSavings)
	.delete(adminDeleteSavings);

module.exports = router;
