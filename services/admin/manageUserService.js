const Chart = require("../../models/Chart");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const Usersetting = require("../../models/Usersetting");
const Wallet = require("../../models/Wallet");
const Watchlist = require("../../models/Watchlist");
const { CustomError } = require("../../utils/utils");
const { getUserById } = require("../user/userService");

async function fetchAllUsers(queryData) {
	const { sortBy, page, limit, filterBy } = queryData;
	try {
		const filter = {};
		if (filterBy) filter[filterBy] = filterBy;

		const sort = {};
		if (sortBy) sort[sortBy] = sortBy;

		const users = await User.find(filter)
			.sort(sort)
			.skip(page - 1, limit)
			.limit(limit);

		const totalUser = await User.countDocuments();
		const totalPages = Math.ceil(totalUser / limit);

		return { users, totalUser, totalPages };
	} catch (error) {
		throw new CustomError(error.message, error.statusCode);
	}
}

async function completeVerification(userId, action) {
	try {
		const user = await getUserById(userId);

		if (action === "approve") {
			user.identityVerification.kycStatus = "approved";
			await user.save();
		}
		if (action === "reject") {
			user.identityVerification.kycStatus = "failed";
			await user.save();
		}

		return user;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function suspendUser(userId) {
	try {
		const user = await getUserById(userId);

		user.accountStatus.banned = true;
		await user.save();

		return user;
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

async function deleteUser(userId) {
	try {
		// Verify user exists
		const user = await getUserById(userId);
		if (!user) {
			throw new CustomError("User not found", 404);
		}

		// Delete related records
		await Promise.all([
			Transaction.deleteMany({ userId }),
			Trade.deleteMany({ userId }),
			Wallet.deleteMany({ userId }),
			Chart.deleteMany({ userId }),
			Watchlist.deleteMany({ userId }),
			Usersetting.deleteMany({ userId }),
		]);

		// Delete the user itself
		await User.findByIdAndDelete(userId);

		return { success: true, message: "User and related data deleted" };
	} catch (error) {
		throw new CustomError(error.message, 500);
	}
}

module.exports = {
	fetchAllUsers,
	completeVerification,
	suspendUser,
	deleteUser,
};
