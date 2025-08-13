const Country = require("../models/Country");
const Nationality = require("../models/Nationality");
const State = require("../models/State");

async function getCountries() {
	try {
		const countries = await Country.find();
		return countries;
	} catch (error) {
		console.log("Failed to fetch countries", error.message);
	}
}

async function getCountryById(countryId) {
	try {
		const country = await Country.findById(countryId);
		if (!country) {
			throw new Error("Country not found!");
		}
		return country;
	} catch (error) {
		console.log("Failed to fetch country", error.message);
	}
}

async function getStates() {
	try {
		const states = await State.find();
		return states;
	} catch (error) {
		console.log("Failed to fetch states", error.message);
	}
}

async function getStateById(stateId) {
	try {
		const state = await State.findById(stateId);
		if (!state) {
			throw new Error("state not found!");
		}
		return state;
	} catch (error) {
		console.log("Failed to fetch state", error.message);
	}
}

async function getNationalities() {
	try {
		const nationalities = await Nationality.find();
		return nationalities;
	} catch (error) {
		console.log("Failed to fetch nationalities", error.message);
	}
}

async function getNationById(nationId) {
	try {
		const nation = await Nationality.findById(nationId);
		if (!nation) {
			throw new Error("nation not found!");
		}
		return nation;
	} catch (error) {
		console.log("Failed to fetch nation", error.message);
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
