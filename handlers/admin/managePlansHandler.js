const {
	addNewPlan,
	removePlan,
	editPlan,
	fetchSinglePlan,
} = require("../../services/admin/managePlansService");
const { fetchPlans } = require("../../services/user/autoPlanService");

const createPlan = async (req, res, next) => {
	const planData = req.body;
	try {
		const planName = await addNewPlan(planData);
		res.status(200).json({
			message: `${planName} added successfully`,
			success: true,
			data: null,
		});
	} catch (error) {
		next(error);
	}
};

const updatePlan = async (req, res, next) => {
	const { planId } = req.params;
	try {
		const planData = { ...req.body, planId };
		const plan = await editPlan(planData);
		res.status(200).json({
			message: `plan updated successfully`,
			success: true,
			data: plan,
		});
	} catch (error) {
		next(error);
	}
};

const deletePlan = async (req, res, next) => {
	const { planId } = req.params;
	try {
		const planName = await removePlan(planId);
		res.status(200).json({
			message: `${planName} deleted successfully`,
			success: true,
			data: null,
		});
	} catch (error) {
		next(error);
	}
};

const singlePlan = async (req, res, next) => {
	const { planId } = req.params;
	try {
		const plan = await fetchSinglePlan(planId);
		res.status(200).json({
			message: `plan fetched successfully`,
			success: true,
			data: plan,
		});
	} catch (error) {
		next(error);
	}
};

const getMyPlans = async (req, res, next) => {
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

module.exports = { createPlan, updatePlan, deletePlan, singlePlan, getMyPlans };
