const { Router } = require("express");
const { getUserChart } = require("../../handlers/user/chartController");

const router = Router();

router.route("/").get(getUserChart);

module.exports = router;
