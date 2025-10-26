const Currency = require("../models/Currency");
const { CustomError } = require("../utils/utils");

async function getCurrencies() {
	try {
		const currencies = await Currency.find().lean();
		return currencies;
	} catch (error) {
		throw new CustomError("Failed to fetch currencies", 500);
	}
}

async function getCurrencyById(currencyId) {
	if (!currencyId) {
		throw new CustomError("Currency ID required!", 400);
	}
	try {
		const currency = await Currency.findById(currencyId);
		if (!currency) throw new Error("Currency not found!", { statusCode: 404 });
		return currency;
	} catch (error) {
		throw new CustomError("Failed to fetch currency info", 500);
	}
}

module.exports = { getCurrencies, getCurrencyById };
