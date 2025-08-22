const Autoplan = require("../../models/Autoplan");
const { throwError } = require("../../utils/utils");

async function addNewPlan(planData) {
	const {
		name,
		type,
		min,
		max,
		winRate,
		expectedreturn,
		dailyReturn,
		aum,
		milestone,
		duration,
		img,
	} = planData;

	if (
		!name ||
		!type ||
		!max ||
		!winRate ||
		!expectedreturn ||
		!dailyReturn ||
		!aum ||
		!milestone ||
		!duration
	)
		throw new Error("Incomplete plan data!", { statusCode: 400 });

	try {
		const newPlanData = {
			name: name,
			planType: type,

			investmentRange: {
				min: min,
				max: max,
			},
			performance: {
				winRate: winRate,
				expectedReturnPercent: expectedreturn,
				dailyReturnPercent: dailyReturn,
				aum: aum,
			},
			expiresIn: {
				milestone: milestone,
				duration: duration,
			},
			img: img,
		};

		const planCreated = await Autoplan.create(newPlanData);
		return planCreated.name;
	} catch (error) {
		throwError(error, "Failed to add new plan. Try again", 500);
	}
}

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
		throwError(error, "Failed to fetch auto invest plans. Try again", 500);
	}
}

async function fetchPlanById(planId) {
	if (!planId) throw new Error("Bad request", { statusCode: 400 });
	try {
		const plan = await Autoplan.findById(planId);
		if (!plan) throw new Error("Plan not found!", { statusCode: 404 });
		return plan;
	} catch (error) {
		throwError(error, "Failed to get plan. Try again", 500);
	}
}

module.exports = { fetchPlanById, fetchPlans, addNewPlan };
