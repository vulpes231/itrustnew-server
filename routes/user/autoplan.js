const { Router } = require("express");
const {
	getAllPlans,
	createPlan,
	getPlan,
} = require("../../handlers/user/autoPlanController");

const router = Router();

router.route("/").get(getAllPlans).post(createPlan);
router.route("/:planId").get(getPlan);

module.exports = router;
