const { Router } = require("express");
const {
  addAsset,
  deleteAsset,
} = require("../../handlers/admin/manageAssetHandler");

const router = Router();

router.route("/").post(addAsset);
router.route("/:assetId").delete(deleteAsset);

module.exports = router;
