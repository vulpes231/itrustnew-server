const { Router } = require("express");
const {
  getTierById,
  submitTierCode,
  getAvailableTiers,
} = require("../../handlers/user/tierController");

const router = Router();

router.route().get(getAvailableTiers).patch(submitTierCode);
router.route("/:tierId").get(getTierById);

module.exports = router;
