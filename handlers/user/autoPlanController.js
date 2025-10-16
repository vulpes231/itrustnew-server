const {
	fetchPlanById,
	fetchPlans,
} = require("../../services/user/autoPlanService");

const getPlan = async (req, res, next) => {
	const { planId } = req.params;
	try {
		const plan = await fetchPlanById(planId);
		res.status(200).json({
			message: `plan fetched successfully`,
			success: true,
			data: plan,
			formattedDuration: plan.formattedDuration,
		});
	} catch (error) {
		next(error);
	}
};

const getAllPlans = async (req, res, next) => {
	const page = Math.max(1, parseInt(req.query.page) || 1);
	const limit = Math.min(50, parseInt(req.query.limit) || 15);
	const sortBy = req.query.sortBy;

	try {
		const { plans, totalPage, totalResult } = await fetchPlans({
			page,
			limit,
			sortBy,
		});
		res.status(200).json({
			success: true,
			data: plans,
			pagination: {
				currentPage: page,
				perPage: limit,
				totalPages: totalPage,
				totalItems: totalResult,
			},
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { getAllPlans, getPlan };
