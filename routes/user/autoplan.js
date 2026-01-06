const { Router } = require("express");
const {
  getAllPlans,
  getPlan,
  startPlan,
} = require("../../handlers/user/autoPlanController");

const router = Router();

router.route("/").get(getAllPlans).post(startPlan);
router.route("/:planId").get(getPlan);

module.exports = router;
