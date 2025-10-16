const { Router } = require("express");
const {
	createPlan,
	updatePlan,
	deletePlan,
	singlePlan,
	getMyPlans,
} = require("../../handlers/admin/managePlansHandler");

const router = Router();

router.route("/").get(getMyPlans).post(createPlan);
router.route("/:planId").get(singlePlan).put(updatePlan).delete(deletePlan);

module.exports = router;
