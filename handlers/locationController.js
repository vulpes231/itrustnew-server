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
		res.status(200).json({ countries });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getCountryInfo = async (req, res) => {
	const { countryId } = req.params;
	try {
		const country = await getCountryById(countryId);
		res.status(200).json({ country });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getAllStates = async (req, res) => {
	try {
		const states = await getStates();
		res.status(200).json({ states });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getStateInfo = async (req, res) => {
	const { stateId } = req.params;
	try {
		const state = await getStateById(stateId);
		res.status(200).json({ state });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getAllNations = async (req, res) => {
	try {
		const nations = await getNationalities();
		res.status(200).json({ nations });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

const getNationalityInfo = async (req, res) => {
	const { nationId } = req.params;
	try {
		const nationality = await getNationById(nationId);
		res.status(200).json({ nationality });
	} catch (error) {
		res.status(500).json({ message: error.message });
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
