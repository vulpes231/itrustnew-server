const { Router } = require("express");
const { getUserPositions } = require("../../handlers/user/positionController");

const router = Router();
router.route("/").get(getUserPositions);
module.exports = router;
