async function buyAsset(userId, assetData) {
	try {
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

//ned to do

module.exports = {
	buyAsset,
	sellAsset,
	fetchUserHoldings,
};
