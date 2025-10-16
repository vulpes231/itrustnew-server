const Autoplan = require("../../models/Autoplan");
const { CustomError } = require("../../utils/utils");

async function fetchPlans(queryData) {
	const { page, limit, sortBy } = queryData;
	try {
		const sort = {};
		if (sortBy === "winRate") sort["performance.winRate"] = 1;
		const plans = await Autoplan.find({})
			.sort(sort)
			.skip((page - 1) * limit)
			.limit(limit);
		const totalResult = await Autoplan.countDocuments();
		const totalPage = Math.ceil(total / limit);
		return { plans, totalResult, totalPage };
	} catch (error) {
		throw new CustomError("Failed to fetch auto invest plans! Try again.", 500);
	}
}

async function fetchPlanById(planId) {
	if (!planId) throw new CustomError("Bad request!", 400);
	try {
		const plan = await Autoplan.findById(planId);
		if (!plan) throw new CustomError("Plan not found!", 404);
		return plan;
	} catch (error) {
		throw new CustomError("Failed to get plan! Try again.", 500);
	}
}

module.exports = { fetchPlanById, fetchPlans };
