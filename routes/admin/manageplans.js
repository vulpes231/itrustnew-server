const { Router } = require("express");
const {
  createPlan,
  updatePlan,
  deletePlan,
  singlePlan,
  getMyPlans,
  updateUserPlan,
  getUserPlans,
} = require("../../handlers/admin/managePlansHandler");
const { upload } = require("../../utils/utils");

const router = Router();

router.route("/").get(getMyPlans).post(upload.single("planImg"), createPlan);
router.route("/user").get(getUserPlans).patch(updateUserPlan);
router
  .route("/:planId")
  .get(singlePlan)
  .patch(upload.single("planImg"), updatePlan)
  .delete(deletePlan);

module.exports = router;
