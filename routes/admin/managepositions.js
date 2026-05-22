const { Router } = require("express");
const {
  getAllPositions,
  getPositionInfo,
  exitTrade,
  editPositionInfo,
  removePositionInfo,
} = require("../../handlers/admin/managePositionHandler");

const router = Router();

router.route("/").get(getAllPositions);
router
  .route("/:positionId")
  .get(getPositionInfo)
  .patch(exitTrade)
  .put(editPositionInfo)
  .delete(removePositionInfo);

module.exports = router;
