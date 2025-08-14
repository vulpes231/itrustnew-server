const {
	getCurrencies,
	getCurrencyById,
} = require("../services/currencyService");

const getAllCurrencies = async (req, res) => {
	try {
		const currencies = await getCurrencies();
		res.status(200).json({ currencies });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getCurrencyInfo = async (req, res) => {
	const { currencyId } = req.params;
	try {
		const currency = await getCurrencyById(currencyId);
		res.status(200).json({ currency });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

module.exports = { getCurrencyInfo, getAllCurrencies };
