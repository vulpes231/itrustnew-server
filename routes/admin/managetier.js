const { Router } = require("express");
const {
  getAllTiers,
  createTier,
  updateTier,
  getTier,
  updateUserTierInfo,
} = require("../../handlers/admin/manageTierHandler");

const router = Router();

router.route("/").get(getAllTiers).post(createTier);
router.route("/user/:userId").patch(updateUserTierInfo);
router.route("/:tierId").get(getTier).patch(updateTier);

module.exports = router;
