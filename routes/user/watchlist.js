const { Router } = require("express");
const {
  getUserWatchlist,
  addAssetToWatchlist,
  removeAssetFromWatchlist,
} = require("../../handlers/user/watchlistController");

const router = Router();

router
  .route("/")
  .get(getUserWatchlist)
  .post(addAssetToWatchlist)
  .put(removeAssetFromWatchlist);

router.route("/check/:assetId");

module.exports = router;
