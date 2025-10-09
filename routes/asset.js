const { Router } = require("express");
const {
	getAssets,
	getAssetInfo,
	getUserAssets,
	searchAssetByName,
} = require("../handlers/assetController");
const { verifyJWT } = require("../middlewares/verifyJWT");

const router = Router();

router.route("/").get(getAssets);
router.route("/search").get(searchAssetByName); // Move this up
router.route("/user").get(getUserAssets, verifyJWT);
router.route("/:assetId").get(getAssetInfo); // Keep parameterized routes last

module.exports = router;
