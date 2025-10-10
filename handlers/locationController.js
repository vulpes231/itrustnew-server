const {
	getCountries,
	getStates,
	getNationalities,
	getCountryById,
	getStateById,
	getNationById,
	searchCountries,
} = require("../services/locationService");

const getAllCountries = async (req, res, next) => {
	try {
		const countries = await getCountries();
		res
			.status(200)
			.json({ data: countries, success: true, message: "Countries retrieved" });
	} catch (error) {
		next(error);
	}
};

const getCountryInfo = async (req, res, next) => {
	const { countryId } = req.params;
	try {
		const country = await getCountryById(countryId);
		res.status(200).json({
			data: country,
			success: true,
			message: "Country info retrieved",
		});
	} catch (error) {
		next(error);
	}
};

const getAllStates = async (req, res, next) => {
	try {
		const states = await getStates();
		res
			.status(200)
			.json({ data: states, success: true, message: "States retrieved" });
	} catch (error) {
		next(error);
	}
};

const getStateInfo = async (req, res, next) => {
	const { stateId } = req.params;
	try {
		const state = await getStateById(stateId);
		res
			.status(200)
			.json({ data: state, success: true, message: "State info retrieved" });
	} catch (error) {
		next(error);
	}
};

const getAllNations = async (req, res, next) => {
	try {
		const nations = await getNationalities();
		res.status(200).json({
			data: nations,
			success: true,
			message: "Nationalities retrieved",
		});
	} catch (error) {
		next(error);
	}
};

const getNationalityInfo = async (req, res, next) => {
	const { nationId } = req.params;
	try {
		const nationality = await getNationById(nationId);
		res.status(200).json({
			data: nationality,
			success: true,
			message: "Nationality info retrieved",
		});
	} catch (error) {
		next(error);
	}
};

const searchCountry = async (req, res, next) => {
	const query = req.query.query;
	console.log(query);
	try {
		const countries = await searchCountries(query);
		res.status(200).json({
			data: countries,
			success: true,
			message: "countries fetched successfully",
		});
	} catch (error) {
		next(error);
	}
};

module.exports = {
	getAllCountries,
	getAllStates,
	getAllNations,
	getCountryInfo,
	getStateInfo,
	getNationalityInfo,
	searchCountry,
};
