const Autoplan = require("../../models/Autoplan");
const Trade = require("../../models/Trade");
const { CustomError } = require("../../utils/utils");

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
		throw new CustomError("Incomplete plan data!", 400);

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
		throw new CustomError(erro.message, 500);
	}
}

async function editPlan(planData) {
	const {
		planId,
		name,
		type,
		winRate,
		aum,
		expectedreturn,
		dailyReturn,
		milestone,
		duration,
	} = planData;

	if (!planId) {
		throw new CustomError("Bad request!", 400);
	}
	try {
		const updateData = {
			$set: {
				...(name && { name }),
				...(type && { type }),
				...(winRate && { winRate }),
				...(aum && { aum }),
				...(expectedreturn && { expectedreturn }),
				...(dailyReturn && { dailyReturn }),
				...(milestone && { milestone }),
				...(duration && { duration }),
			},
		};

		const plan = await Autoplan.findByIdAndUpdate(planId, updateData, {
			new: true,
			runValidators: true,
		});
		if (!plan) {
			throw new CustomError("Invalid plan!", 404);
		}
		return plan;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function removePlan(planId) {
	try {
		const plan = await Autoplan.findById(planId);
		if (plan) {
			throw new CustomError("Invalid plan!", 404);
		}

		const positionCount = await Trade.countDocuments({ planId: plan._id });
		if (positionCount > 0) {
			throw new CustomError("You have open trades with this plan!", 403);
		}

		await Autoplan.findByIdAndDelete(plan._id);
		return true;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function fetchSinglePlan(planId) {
	try {
		const plan = await Autoplan.findById(planId).lean();
		if (plan) {
			throw new CustomError("Invalid plan!", 404);
		}
		return plan;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

module.exports = { addNewPlan, editPlan, removePlan, fetchSinglePlan };
