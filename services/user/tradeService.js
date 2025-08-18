const Wallet = require("../../models/Wallet");
const { fetchAssetById } = require("../assetService");
const { fetchPlanById } = require("./autoPlanService");

async function buyAsset(userId, assetData) {
	const {
		assetId,
		planId,
		orderType,
		accountType,
		amount,
		leverage,
		interval,
		tp,
		sl,
		entry,
		exit,
	} = assetData;
	if (!assetId || !orderType || !accountType || !amount)
		throw new Error("Bad request!");
	try {
		const asset = await fetchAssetById(assetId);
		if (!asset) throw new Error("Invalid asset!");

		const userWallet = await Wallet.findOne({ userId, name: accountType });
		if (!userWallet) throw new Error("Invalid wallet!");

		const parsedAmount = parseFloat(amount);

		if (userWallet.availableBalance <= parsedAmount)
			throw new Error("Insufficient funds!");

		let plan;

		if (planId) {
			plan = await fetchPlanById(planId);
		}
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to open position!");
	}
}

async function sellAsset(userId, assetData) {
	try {
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to close position!");
	}
}

async function fetchUserHoldings(userId) {
	try {
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to fetch user holding!");
	}
}

async function fetchUserTrades(userId) {
	try {
	} catch (error) {
		console.log(error.message);
		throw new Error("Failed to fetch user holding!");
	}
}

module.exports = {
	buyAsset,
	sellAsset,
	fetchUserHoldings,
};
