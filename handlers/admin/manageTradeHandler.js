const {
	createTrade,
	closeTrade,
	editTradeData,
	getTradeById,
	fetchAllTrades,
} = require("../../services/admin/manageTradeService");

const addNewTrade = async (req, res, next) => {
	const tradeData = req.body;
	console.log(req.body);
	try {
		const trade = await createTrade(tradeData);
		res.status(200).json({
			message: "Trade created successfully.",
			data: trade,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

const exitTrade = async (req, res, next) => {
	const { tradeId } = req.params;
	console.log(tradeId);
	try {
		const closedTrade = await closeTrade(tradeId);
		res.status(200).json({
			message: "Trade closed successfully.",
			data: closedTrade,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

const updateTrade = async (req, res, next) => {
	const tradeData = req.body;

	console.log(req.body);
	try {
		const trade = await editTradeData(tradeData);
		res.status(200).json({
			message: "Trade updated successfully.",
			data: trade,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

const getTradeInfo = async (req, res, next) => {
	const { tradeId } = req.params;
	try {
		const trade = await getTradeById(tradeId);
		res.status(200).json({
			message: "Trade info fetched successfully.",
			data: trade,
			success: true,
		});
	} catch (error) {
		next(error);
	}
};

const getAllTrades = async (req, res, next) => {
	const page = Math.max(1, req.query.page || 1);
	const limit = Math.min(15, req.query.limit || 15);
	const sortBy = req.query.sortBy || "createdAt";
	const filterBy = req.query.filterBy;
	const queryData = { page, limit, sortBy, filterBy };
	try {
		const { trades, totalItems, totalPages, currentPage } =
			await fetchAllTrades(queryData);
		res.status(200).json({
			message: "Trades fetched successfully.",
			data: trades,
			success: true,
			pagination: {
				totalItems,
				totalPages,
				currentPage,
			},
		});
	} catch (error) {
		next(error);
	}
};

module.exports = {
	getAllTrades,
	getTradeInfo,
	exitTrade,
	updateTrade,
	addNewTrade,
};
