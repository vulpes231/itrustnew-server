const { Router } = require("express");
const {
  toggleDripOption,
  toggleMarginTrading,
  toggleOptionsTrading,
  toggleEmailNotify,
  toggleOrderNotify,
  togglePriceAlert,
  toggleDeviceAlert,
} = require("../../handlers/user/profileSettingController");

const router = Router();

router.route("/drip").patch(toggleDripOption);
router.route("/margin").patch(toggleMarginTrading);
router.route("/options").patch(toggleOptionsTrading);
router.route("/email-notify").patch(toggleEmailNotify);
router.route("/order-notify").patch(toggleOrderNotify);
router.route("/price-alert").patch(togglePriceAlert);
router.route("/login-alert").patch(toggleDeviceAlert);

module.exports = router;
