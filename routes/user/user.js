const { Router } = require("express");
const {
	getUserInfo,
	editUserInfo,
	changePassword,
	setBeneficiary,
	setTwoFactor,
} = require("../../handlers/user/userController");

const router = Router();

router.route("/").get(getUserInfo).put(editUserInfo);
router.route("/change-password").post(changePassword);
router.route("/beneficiary").post(setBeneficiary);
router.route("/twofactor").post(setTwoFactor);

module.exports = router;
