const Currency = require("../models/Currency");
const { throwError } = require("../utils/utils");

async function getCurrencies() {
	try {
		const currencies = await Currency.find().lean();
		return currencies;
	} catch (error) {
		throwError(error, "Failed to fetch currencies", 500);
	}
}

async function getCurrencyById(currencyId) {
	if (currencyId) {
		throw new Error("Currency ID required!", { statusCode: 400 });
	}
	try {
		const currency = await Currency.findById(currencyId);
		if (!currency) throw new Error("Currency not found!", { statusCode: 404 });
		return currency;
	} catch (error) {
		throwError(error, "Failed to fetch currency info", 500);
	}
}

module.exports = { getCurrencies, getCurrencyById };
