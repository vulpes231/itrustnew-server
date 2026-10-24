const { default: mongoose } = require("mongoose");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const Usersetting = require("../../models/Usersetting");
const Verification = require("../../models/Verification");
const Wallet = require("../../models/Wallet");
const Watchlist = require("../../models/Watchlist");
const { CustomError } = require("../../utils/utils");
const { getUserById } = require("../user/userService");
const Transaction = require("../../models/Transaction");
const Position = require("../../models/Position");
const Portfolio = require("../../models/Portfolio");

const fs = require("fs").promises;

async function diagnoseUserQuery() {
  const db = mongoose.connection.db;

  console.time("A: MongoDB ping");
  await db.command({ ping: 1 });
  console.timeEnd("A: MongoDB ping");

  console.time("B: Native MongoDB query");

  const nativeUsers = await User.collection
    .find(
      {},
      {
        projection: {
          _id: 1,
          createdAt: 1,
          "personalInfo.firstName": 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .toArray();

  console.timeEnd("B: Native MongoDB query");
  console.log("Native result count:", nativeUsers.length);

  console.time("C: Mongoose query");

  const mongooseUsers = await User.find({})
    .select("_id createdAt personalInfo.firstName")
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  console.timeEnd("C: Mongoose query");
  console.log("Mongoose result count:", mongooseUsers.length);
}

async function fetchAllUsers(queryData = {}) {
  const startedAt = Date.now();

  const { sortBy = "createdAt", sortOrder = "desc", filterBy } = queryData;

  try {
    const filter = {};

    if (filterBy && typeof filterBy === "object") {
      Object.assign(filter, filterBy);
    }

    const sort = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;
    }

    // const fields = [
    //   "personalInfo.firstName",
    //   "personalInfo.lastName",
    //   "personalInfo.username",
    //   "contactInfo.email",
    //   "contactInfo.phone",
    //   "contactInfo.country",
    //   "accountStatus.status",
    //   "accountStatus.emailVerified",
    //   "role",
    //   "createdAt",
    // ].join(" ");

    // diagnoseUserQuery().catch(console.error);

    const users = await User.find(filter)
      .select(
        [
          "personalInfo.firstName",
          "personalInfo.lastName",
          "personalInfo.username",
          "contactInfo.email",
          "contactInfo.phone",
          "contactInfo.country",
          "accountStatus.status",
          "accountStatus.emailVerified",
          "role",
          "createdAt",
        ].join(" "),
      )
      .sort(sort)
      .lean();

    // console.timeEnd("A: find users");

    // console.time("B: count users");

    const totalUser = await User.countDocuments(filter);

    // console.timeEnd("B: count users");

    // console.log("Users returned:", users.length);
    // console.log("Total service time:", Date.now() - startedAt, "ms");

    return { users, totalUser };
  } catch (error) {
    console.error("fetchAllUsers failed:", error);
    throw new CustomError(error.message, error.statusCode);
  }
}

async function fetchUser(userId) {
  if (!userId) {
    throw new CustomError("Bad request!", 400);
  }
  try {
    const user = await User.findById(userId).select(
      "-credentials.password -credentials.refreshToken",
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
    throw new CustomError("Verification ID is required!", 400);
  }

  const session = await mongoose.startSession();

  try {
    let updatedUser;

    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new CustomError("User not found!", 404);
      }

      const submittedData =
        await Verification.findById(verifyId).session(session);

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
        idBack: submittedData.backId || null,
        verifiedAt: new Date(),
      };

      submittedData.status = "approved";

      await Promise.all([
        user.save({ session }),
        submittedData.save({ session }),
      ]);

      updatedUser = user;
    });

    const userInfo = await User.findById(userId).select("-credentials");

    return {
      success: true,
      user: userInfo,
    };
  } catch (error) {
    console.log(error);
    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Verification completion error:", error);

    throw new CustomError(
      error.message || "Failed to complete verification",
      500,
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
      Portfolio.deleteMany({ userId }),
      Position.deleteMany({ userId }),
      Watchlist.deleteMany({ userId }),
      Usersetting.deleteMany({ userId }),
    ]);

    await User.findByIdAndDelete(userId);

    return { success: true, message: "User and related data deleted" };
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function approveWalletConnection(formData) {
  const { userId, action } = formData;

  if (!userId || !action) {
    throw new CustomError("Bad request!", 400);
  }

  const allowedActions = ["accept", "reject"];
  try {
    if (!allowedActions.includes(action)) {
      throw new CustomError("Invalid operation!", 400);
    }

    const user = await Usersetting.findOne({ userId });
    if (!user) throw new CustomError("User not found!", 404);

    // if (user.wallet.status !== "pending") {
    //   throw new CustomError("No pending connection!", 400);
    // }

    if (action === "accept") {
      user.wallet.status = "connected";
      user.wallet.isConnected = true;
    } else {
      // user.wallet.walletName = "";
      // user.wallet.walletInfo = "";
      user.wallet.status = "disconnected";
      user.wallet.isConnected = false;
    }

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

async function getPendingConnectionRequests() {
  try {
    const requests = await Usersetting.find();

    const filteredRquests = requests.filter(
      (rq) => rq.wallet.status === "pending",
    );

    return filteredRquests;
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

    const submittedData =
      await Verification.findById(verifyId).session(session);
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
      { session },
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
      error.statusCode || 500,
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

    const submittedData =
      await Verification.findById(verifyId).session(session);
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

    return { success: true, user, status: "failed" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error instanceof CustomError) throw error;

    throw new CustomError(
      error.message || "Internal server error",
      error.statusCode || 500,
    );
  }
}

async function verifyUserAddress(formData) {
  const VALID_ACTIONS = ["accept", "reject"];

  const { userId, action } = formData;

  if (!userId || !action) {
    throw new CustomError("Bad request! UserId and action are required.", 400);
  }

  if (!VALID_ACTIONS.includes(action)) {
    throw new CustomError(
      `Invalid action! Must be one of: ${VALID_ACTIONS.join(", ")}`,
      400,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    if (user.contactInfo.status !== "pending") {
      throw new CustomError(
        `Cannot ${action} address verification. Current status: ${user.contactInfo.status}`,
        400,
      );
    }

    const updates = {
      accept: {
        "contactInfo.isAddressVerified": true,
        "contactInfo.status": "verified",
        "contactInfo.verifiedAt": new Date(),
      },
      reject: {
        "contactInfo.isAddressVerified": false,
        "contactInfo.status": "rejected",
        "contactInfo.rejectedAt": new Date(),
      },
    };

    await User.updateOne(
      { _id: userId },
      { $set: updates[action] },
      { session },
    );

    await session.commitTransaction();

    return {
      success: true,
      userId,
      action,
      newStatus: updates[action]["contactInfo.status"],
    };
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof CustomError) throw error;
    throw new CustomError(
      error.message || "Failed to verify user address",
      500,
    );
  } finally {
    session.endSession();
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
  verifyUserAddress,
  getPendingConnectionRequests,
};
