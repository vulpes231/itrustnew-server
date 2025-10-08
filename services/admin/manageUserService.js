const Chart = require("../../models/Chart");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const Usersetting = require("../../models/Usersetting");
const Wallet = require("../../models/Wallet");
const Watchlist = require("../../models/Watchlist");
const { CustomError } = require("../../utils/utils");
const { getUserById } = require("../user/userService");

async function fetchAllUsers(queryData) {
	const {
		sortBy = "createdAt",
		sortOrder = "desc",
		page = 1,
		limit = 15,
		filterBy,
	} = queryData;
	try {
		const filter = {};
		// Expecting filterBy to be like { field: value }
		if (filterBy && typeof filterBy === "object") {
			Object.assign(filter, filterBy);
		}

		const sort = {};
		if (sortBy) sort[sortBy] = sortOrder === "asc" ? 1 : -1;

		const users = await User.find(filter)
			.sort(sort)
			.skip((page - 1) * limit)
			.limit(limit);

		const totalUser = await User.countDocuments(filter);
		const totalPages =
			Math.ceil(totalUser / limit) === 0 ? 1 : Math.ceil(totalUser / limit);

		return { users, totalUser, totalPages };
	} catch (error) {
		throw new CustomError(error.message, error.statusCode);
	}
}

async function fetchUser(userId) {
	if (!userId) {
		throw new CustomError("Bad request!", 400);
	}
	try {
		const user = await User.findById(userId).select(
			"-credentials.password -credentials.refreshToken"
		);

		if (!user) {
			throw new CustomError("User not found", 404);
		}

		const userSettings = await Usersetting.findOne({ userId: user._id });

		// Convert both to plain objects and combine
		const userData = {
			...user.toObject(), // Convert Mongoose document to plain object
			settings: userSettings ? userSettings.toObject() : null,
		};

		return userData;
	} catch (error) {
		throw new CustomError(error.message, error.code || 500);
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

		user.accountStatus.banned = true ? false : true;
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
	fetchUser,
};
