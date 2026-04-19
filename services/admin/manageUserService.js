const { default: mongoose } = require("mongoose");
const Chart = require("../../models/Chart");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const Usersetting = require("../../models/Usersetting");
const Verification = require("../../models/Verification");
const Wallet = require("../../models/Wallet");
const Watchlist = require("../../models/Watchlist");
const { CustomError } = require("../../utils/utils");
const { getUserById } = require("../user/userService");

const fs = require("fs").promises;

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

    const userData = {
      ...user.toObject(),
      settings: userSettings ? userSettings.toObject() : null,
    };

    return userData;
  } catch (error) {
    throw new CustomError(error.message, error.code || 500);
  }
}

async function completeVerification(userId, verifyData) {
  const { verifyId } = verifyData;

  if (!verifyId) {
    throw new CustomError("Bad request!", 400);
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const [user, submittedData] = await Promise.all([
      User.findById(userId).session(session),
      Verification.findById(verifyId).session(session),
    ]);

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    if (!submittedData) {
      throw new CustomError("Invalid verification info!", 404);
    }

    if (submittedData.status && submittedData.status !== "pending") {
      throw new CustomError("Verification request already processed!", 400);
    }

    user.identityVerification = {
      kycStatus: "approved",
      idType: submittedData.idType,
      idFront: submittedData.frontId,
      idBack: submittedData?.backId || null,
      verifiedAt: new Date(),
    };

    submittedData.status = "approved";
    await Promise.all([
      user.save({ session }),
      submittedData.save({ session }),
    ]);

    await session.commitTransaction();

    return true;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Verification completion error:", error);
    throw new CustomError(
      error.message || "Failed to complete verification",
      500
    );
  } finally {
    await session.endSession();
  }
}

async function suspendUser(userId) {
  try {
    const user = await getUserById(userId);
    user.accountStatus.banned = !user.accountStatus.banned;
    await user.save();
    return user;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function deleteUser(userId) {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new CustomError("User not found", 404);
    }

    await Promise.all([
      Transaction.deleteMany({ userId }),
      Trade.deleteMany({ userId }),
      Wallet.deleteMany({ userId }),
      Chart.deleteMany({ userId }),
      Watchlist.deleteMany({ userId }),
      Usersetting.deleteMany({ userId }),
    ]);

    await User.findByIdAndDelete(userId);

    return { success: true, message: "User and related data deleted" };
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function approveWalletConnection(userId) {
  try {
    const user = await Usersetting.findOne({ userId });
    if (!user) throw new CustomError("User not found!", 404);

    if (user.wallet.isConnected === true) {
      throw new CustomError("Wallet Approved already!!", 400);
    }

    user.wallet.isConnected = true;
    await user.save();
    return true;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function getUserSettings(userId) {
  try {
    const user = await Usersetting.findOne({ userId });
    if (!user) throw new CustomError("User not found!", 404);

    return user;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function resetVerification(userId, verifyId) {
  if (!verifyId || !userId) {
    throw new CustomError("Bad request!", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let frontIdPath;
  let backIdPath;

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    const submittedData = await Verification.findById(verifyId).session(
      session
    );
    if (!submittedData) {
      throw new CustomError("Verification data not found!", 404);
    }

    if (submittedData.userId.toString() !== userId.toString()) {
      throw new CustomError("Unauthorized action", 403);
    }

    frontIdPath = submittedData.frontId;
    backIdPath = submittedData.backId;

    const deleteResult = await Verification.deleteOne(
      { _id: verifyId },
      { session }
    );

    if (deleteResult.deletedCount === 0) {
      throw new CustomError("Failed to delete verification data", 500);
    }

    user.identityVerification.kycStatus = "not verified";
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    const deleteFile = async (path) => {
      if (!path) return;
      try {
        await fs.unlink(path);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("File deletion error:", err);
        }
      }
    };

    await Promise.all([deleteFile(frontIdPath), deleteFile(backIdPath)]);

    return true;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error instanceof CustomError) throw error;

    throw new CustomError(
      error.message || "Internal server error",
      error.statusCode || 500
    );
  }
}

async function rejectVerification(userId, verifyId) {
  if (!userId || !verifyId) {
    throw new CustomError("Bad request!", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    const submittedData = await Verification.findById(verifyId).session(
      session
    );
    if (!submittedData) {
      throw new CustomError("Verification data not found!", 404);
    }
    if (!submittedData.status !== "pending") {
      throw new CustomError("Invalid operation!", 404);
    }

    if (submittedData.userId.toString() !== userId.toString()) {
      throw new CustomError("Unauthorized action", 403);
    }

    submittedData.status = "failed";
    await submittedData.save({ session });

    user.identityVerification.kycStatus = "failed";
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { status: "failed" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error instanceof CustomError) throw error;

    throw new CustomError(
      error.message || "Internal server error",
      error.statusCode || 500
    );
  }
}

module.exports = {
  fetchAllUsers,
  completeVerification,
  suspendUser,
  deleteUser,
  fetchUser,
  approveWalletConnection,
  getUserSettings,
  rejectVerification,
  resetVerification,
};
