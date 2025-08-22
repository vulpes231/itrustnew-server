const {
	getCountries,
	getStates,
	getNationalities,
	getCountryById,
	getStateById,
	getNationById,
} = require("../services/locationService");

const getAllCountries = async (req, res) => {
	try {
		const countries = await getCountries();
		res
			.status(200)
			.json({ data: countries, success: true, message: "Countries retrieved" });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getCountryInfo = async (req, res) => {
	const { countryId } = req.params;
	try {
		const country = await getCountryById(countryId);
		res.status(200).json({
			data: country,
			success: true,
			message: "Country info retrieved",
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getAllStates = async (req, res) => {
	try {
		const states = await getStates();
		res
			.status(200)
			.json({ data: states, success: true, message: "States retrieved" });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getStateInfo = async (req, res) => {
	const { stateId } = req.params;
	try {
		const state = await getStateById(stateId);
		res
			.status(200)
			.json({ data: state, success: true, message: "State info retrieved" });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getAllNations = async (req, res) => {
	try {
		const nations = await getNationalities();
		res.status(200).json({
			data: nations,
			success: true,
			message: "Nationalities retrieved",
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

const getNationalityInfo = async (req, res) => {
	const { nationId } = req.params;
	try {
		const nationality = await getNationById(nationId);
		res.status(200).json({
			data: nationality,
			success: true,
			message: "Nationality info retrieved",
		});
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({ message: error.message, success: false });
	}
};

module.exports = {
	getAllCountries,
	getAllStates,
	getAllNations,
	getCountryInfo,
	getStateInfo,
	getNationalityInfo,
};
