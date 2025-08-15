const { Router } = require("express");
const {
	getAssets,
	getAssetInfo,
	getUserAssets,
} = require("../handlers/assetController");
const { verifyJWT } = require("../middlewares/verifyJWT");

const router = Router();

router.route("/").get(getAssets);
router.route("/:assetId").get(getAssetInfo);
router.route("/user").get(getUserAssets, verifyJWT);

module.exports = router;
