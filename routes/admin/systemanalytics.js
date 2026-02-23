const { Router } = require("express");
const {
  getSystemAnalytics,
  getRecentActivities,
  getRecentTransacts,
  getRecentUsers,
} = require("../../handlers/admin/adminAnalyticsHandler");

const router = Router();
router.route("/").get(getSystemAnalytics);
router.route("/activities").get(getRecentActivities);
router.route("/users").get(getRecentUsers);
router.route("/transactions").get(getRecentTransacts);

module.exports = router;
