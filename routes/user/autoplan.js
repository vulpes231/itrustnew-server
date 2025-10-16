const { Router } = require("express");
const {
	getAllPlans,
	getPlan,
} = require("../../handlers/user/autoPlanController");

const router = Router();

router.route("/").get(getAllPlans);
router.route("/:planId").get(getPlan);

module.exports = router;
