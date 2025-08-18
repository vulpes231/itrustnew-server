const {
	addNewPlan,
	fetchPlanById,
	fetchPlans,
} = require("../../services/user/autoPlanService");

const createPlan = async (req, res) => {
	const planData = req.body;
	try {
		const planName = await addNewPlan(planData);
		res
			.status(201)
			.json({ message: `${planName} added successfully`, success: true });
	} catch (error) {
		console.log(error);
		res.status(500).json({ message: error.message, success: false });
	}
};

const getPlan = async (req, res) => {
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
		console.log(error);
		res.status(500).json({ message: error.message, success: false });
	}
};

const getAllPlans = async (req, res) => {
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
		res.status(500).json({
			success: false,
			message: "Failed to fetch plans: " + error.message,
		});
	}
};

module.exports = { getAllPlans, getPlan, createPlan };
