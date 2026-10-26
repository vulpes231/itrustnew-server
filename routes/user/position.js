const { Router } = require("express");
const {
  getUserPositions,
  closeFullPosition,
} = require("../../handlers/user/positionController");

const router = Router();
router.route("/").get(getUserPositions).patch(closeFullPosition);
module.exports = router;
