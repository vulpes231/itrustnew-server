const {
	getCurrencies,
	getCurrencyById,
} = require("../services/currencyService");

const getAllCurrencies = async (req, res) => {
	try {
		const currencies = await getCurrencies();
		res.status(200).json({
			data: currencies,
			success: true,
			message: "Currencies fetched successfully",
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getCurrencyInfo = async (req, res) => {
	const { currencyId } = req.params;
	try {
		const currency = await getCurrencyById(currencyId);
		res.status(200).json({
			data: currency,
			success: true,
			message: "Currency fetched successfully",
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

module.exports = { getCurrencyInfo, getAllCurrencies };
