const Country = require("../models/Country");
const Nationality = require("../models/Nationality");
const State = require("../models/State");
const { throwError } = require("../utils/utils");

async function getCountries() {
	try {
		const countries = await Country.find().lean();
		return countries;
	} catch (error) {
		throwError(error, "Failed to fetch countries", 500);
	}
}

async function getCountryById(countryId) {
	if (!countryId) {
		throw new Error("Country ID required!", { statusCode: 400 });
	}
	try {
		const country = await Country.findById(countryId);
		if (!country) {
			throw new Error("Country not found!", { statusCode: 404 });
		}
		return country;
	} catch (error) {
		throwError(error, "Failed to fetch country", 500);
	}
}

async function getStates() {
	try {
		const states = await State.find().lean();
		return states;
	} catch (error) {
		throwError(error, "Failed to fetch states", error.message);
	}
}

async function getStateById(stateId) {
	if (!stateId) {
		throw new Error("State ID required!", { statusCode: 400 });
	}
	try {
		const state = await State.findById(stateId);
		if (!state) {
			throw new Error("state not found!", { statusCode: 404 });
		}
		return state;
	} catch (error) {
		throwError(error, "Failed to fetch state", 500);
	}
}

async function getNationalities() {
	try {
		const nationalities = await Nationality.find().lean();
		return nationalities;
	} catch (error) {
		throwError(error, "Failed to fetch nationalities", 500);
	}
}

async function getNationById(nationId) {
	if (!nationId) {
		throw new Error("Nationality ID required!", { statusCode: 400 });
	}
	try {
		const nation = await Nationality.findById(nationId);
		if (!nation) {
			throw new Error("nation not found!", { statusCode: 404 });
		}
		return nation;
	} catch (error) {
		throwError(error, "Failed to fetch nation", 500);
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
