const { Router } = require("express");
const {
  getAllPositions,
  getPositionInfo,
  exitTrade,
} = require("../../handlers/admin/managePositionHandler");

const router = Router();

router.route("/").get(getAllPositions);
router.route("/:positionId").get(getPositionInfo).patch(exitTrade);

module.exports = router;
