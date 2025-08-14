const { Router } = require("express");
const {
	verifyLoginCode,
	verifyEmailCode,
} = require("../../handlers/user/verifyController");
const { verifyJWT } = require("../../middlewares/verifyJWT");

const router = Router();

router.route("/auth").post(verifyLoginCode);
router.route("/mail").post(verifyEmailCode, verifyJWT);

module.exports = router;
