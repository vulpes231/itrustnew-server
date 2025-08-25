const Country = require("../models/Country");
const Nationality = require("../models/Nationality");
const State = require("../models/State");
const { CustomError } = require("../utils/utils");

async function getCountries() {
	try {
		const countries = await Country.find().lean();
		return countries;
	} catch (error) {
		throw new CustomError("Failed to fetch countries", 500);
	}
}

async function getCountryById(countryId) {
	if (!countryId) {
		throw new CustomError("Country ID required!", 400);
	}
	try {
		const country = await Country.findById(countryId);
		if (!country) {
			throw new CustomError("Country not found!", 404);
		}
		return country;
	} catch (error) {
		throw new CustomError("Failed to fetch country", 500);
	}
}

async function getStates() {
	try {
		const states = await State.find().lean();
		return states;
	} catch (error) {
		throw new CustomError("Failed to fetch states", 500);
	}
}

async function getStateById(stateId) {
	if (!stateId) {
		throw new CustomError("State ID required!", 400);
	}
	try {
		const state = await State.findById(stateId);
		if (!state) {
			throw new CustomError("state not found!", 404);
		}
		return state;
	} catch (error) {
		throw new CustomError("Failed to fetch state", 500);
	}
}

async function getNationalities() {
	try {
		const nationalities = await Nationality.find().lean();
		return nationalities;
	} catch (error) {
		throw new CustomError("Failed to fetch nationalities", 500);
	}
}

async function getNationById(nationId) {
	if (!nationId) {
		throw new CustomError("Nationality ID required!", 400);
	}
	try {
		const nation = await Nationality.findById(nationId);
		if (!nation) {
			throw new CustomError("nation not found!", 404);
		}
		return nation;
	} catch (error) {
		throw new CustomError("Failed to fetch nation", 500);
	}
}

module.exports = {
	getCountries,
	getStates,
	getNationalities,
	getStateById,
	getCountryById,
	getNationById,
};
