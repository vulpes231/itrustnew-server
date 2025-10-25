const { Router } = require("express");
const {
	getAllCurrencies,
	getCurrencyInfo,
} = require("../handlers/currencyController");

const router = Router();

router.route("/").get(getAllCurrencies);
router.route("/:currencyId").get(getCurrencyInfo);

module.exports = router;
