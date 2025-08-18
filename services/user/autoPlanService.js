const Autoplan = require("../../models/Autoplan");

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
		throw new Error("Incomplete plan data!");

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
		console.log(error.message);
		throw new Error("Failed to add auto invest plan!");
	}
}

async function fetchPlans(queryData) {
	const { page, limit, sortBy } = queryData;
	try {
		const sort = {};
		if (sortBy === "winRate") sort["performance.winRate"] = 1;
		const plans = await Autoplan.find({})
			.sort(sort)
			.limit((page - 1) * limit);

		return plans;
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to fetch auto invest plans!");
	}
}

async function fetchPlanById(planId) {
	if (!planId) throw new Error("Bad request");
	try {
		const plan = await Autoplan.findById(planId);
		if (!plan) throw new Error("Plan not found!");
		return plan;
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to fetch plan!");
	}
}

module.exports = { fetchPlanById, fetchPlans, addNewPlan };
