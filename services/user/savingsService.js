const SavingsAccount = require("../../models/Savingsaccount");
const User = require("../../models/User");
const { throwError } = require("../../utils/utils");

async function fetchAvailableSavings() {
	try {
		const savingsAccounts = await SavingsAccount.find().lean();
		return savingsAccounts;
	} catch (error) {
		throwError(error, "Failed to fetch savings account", 500);
	}
}

async function addSavingsAccount(userId, accountId) {
	if (!userId || !accountId)
		throw new Error("Bad request!", { statusCode: 400 });

	try {
		const user = await User.findById(userId);
		if (!user) throw new Error("Invalid credentials!", { statusCode: 404 });

		const acct = await SavingsAccount.findById(accountId);
		if (!acct) throw new Error("Account not found!", { statusCode: 404 });

		const userCountryId = user.locationDetails.country.countryId;

		const canOpenAccount = acct.eligibleCountries.find(
			(countryId) => countryId === userCountryId
		);
		if (!canOpenAccount)
			throw new Error("Account not available in your location!", {
				statusCode: 400,
			});

		const acctExistsInUserSavings = user.savingsAccounts.find(
			(acct) => acct.accountId === acct._id
		);
		if (acctExistsInUserSavings)
			throw new Error("Account exist already!", { statusCode: 409 });

		const newAccountData = {
			name: acct.name,
			accountId: acct._id,
			analytics: {
				totalReturn: 0,
				dailyChange: 0,
				balance: 0,
			},
		};

		user.savingsAccounts.push(newAccountData);

		await user.save();
		return newAccountData.name;
	} catch (error) {
		throwError(error, "Failed to fetch add savings", 500);
	}
}

async function fetchSavingsAnalytics(userId) {
	if (!userId) throw new Error("Bad request", { statusCode: 400 });
	try {
		const user = await User.findById(userId);
		if (!user) throw new Error("Invalid credentials!", { statusCode: 404 });

		const userSavingsAccount = user.savingsAccounts;
		return userSavingsAccount;
	} catch (error) {
		throwError(error, "Failed to fetch savings analytics", 500);
	}
}

async function fetchUserSavingsAccount(userId) {
	if (!userId) throw new Error("Bad request", { statusCode: 400 });
	try {
		const user = await User.findById(userId);

		if (!user) throw new Error("Invalid credentials!", { statusCode: 401 });
		const userSavingsAccount = user.savingsAccounts;
		return userSavingsAccount;
	} catch (error) {
		throwError(error, "Failed to fetch user savings account", 500);
	}
}

async function fetchUserSavingsHistory(userId) {}
async function fundSavings(fundData) {}
async function withdrawSavings(withdrawData) {}

module.exports = {
	fetchAvailableSavings,
	fetchSavingsAnalytics,
	fetchUserSavingsAccount,
	fetchUserSavingsHistory,
	addSavingsAccount,
	fundSavings,
	withdrawSavings,
};
