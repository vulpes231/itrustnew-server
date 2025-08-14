const Currency = require("../models/Currency");

async function getCurrencies() {
	try {
		const currencies = await Currency.find();
		return currencies;
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to fetch currencies");
	}
}

async function getCurrencyById(currencyId) {
	if (currencyId) {
		throw new Error("Currency ID required!");
	}
	try {
		const currency = await Currency.findById(currencyId);
		return currency;
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to fetch currency info");
	}
}

module.exports = { getCurrencies, getCurrencyById };
