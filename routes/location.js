const { Router } = require("express");
const {
	getAllCountries,
	getAllNations,
	getAllStates,
	getCountryInfo,
	getStateInfo,
	getNationalityInfo,
	searchCountry,
	getFilteredStates,
} = require("../handlers/locationController");

const router = Router();

router.route("/countries").get(getAllCountries);
router.route("/search").get(searchCountry);
router.route("/country/:countryId").get(getCountryInfo);
router.route("/state/:countryId").get(getFilteredStates);
router.route("/states").get(getAllStates);
router.route("/state/:stateId").get(getStateInfo);

router.route("/nationalities").get(getAllNations);
router.route("/nation/:nationId").get(getNationalityInfo);

module.exports = router;
