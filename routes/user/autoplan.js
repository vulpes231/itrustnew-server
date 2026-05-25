const { Router } = require("express");
const {
  getAllPlans,
  getPlan,
  startPlan,
  getAutoTotalInvested,
} = require("../../handlers/user/autoPlanController");

const router = Router();

router.route("/").get(getAllPlans).post(startPlan);
router.route("/user").get(getAutoTotalInvested);
router.route("/:planId").get(getPlan);

module.exports = router;
