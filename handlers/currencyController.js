const {
	getCurrencies,
	getCurrencyById,
} = require("../services/currencyService");

const getAllCurrencies = async (req, res, next) => {
	try {
		const currencies = await getCurrencies();
		res.status(200).json({
			data: currencies,
			success: true,
			message: "Currencies fetched successfully",
		});
	} catch (error) {
		next(error);
	}
};

const getCurrencyInfo = async (req, res, next) => {
	const { currencyId } = req.params;
	try {
		const currency = await getCurrencyById(currencyId);
		res.status(200).json({
			data: currency,
			success: true,
			message: "Currency fetched successfully",
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { getCurrencyInfo, getAllCurrencies };
