const {
  fetchAllUsers,
  completeVerification,
  suspendUser,
  deleteUser,
  fetchUser,
  approveWalletConnection,
} = require("../../services/admin/manageUserService");
const { getUserVerifyInfo } = require("../../services/user/verifyService");

const getUser = async (req, res, next) => {
  const { userId } = req.params;

  try {
    const user = await fetchUser(userId);
    res.status(200).json({
      data: user,
      success: true,
      message: "User fetched successfully.",
    });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  const sortBy = req.query["sort_by"];
  const filterBy = req.query["filter_by"];
  const page = Math.max(req.query.page || 1);
  const limit = Math.min(req.query.limit || 15);
  try {
    const queryData = { sortBy, filterBy, page, limit };
    const { users, totalUser, totalPages } = await fetchAllUsers(queryData);
    res.status(200).json({
      data: users,
      pagination: {
        totalPage: totalPages,
        currentPage: page,
        totalItems: totalUser,
      },
      success: true,
      message: "User fetched successfully.",
    });
  } catch (error) {
    next(error);
  }
};

const reviewVerification = async (req, res, next) => {
  const { action, verifyId } = req.body;
  const { userId } = req.params;
  try {
    await completeVerification(userId, { action, verifyId });

    res.status(200).json({
      data: null,
      success: true,
      message: "Verification complete",
    });
  } catch (error) {
    next(error);
  }
};

const getVerifyData = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const info = await getUserVerifyInfo(userId);

    res.status(200).json({
      data: info,
      success: true,
      message: "Fetch Success",
    });
  } catch (error) {
    next(error);
  }
};

const connectWallet = async (req, res, next) => {
  const { userId } = req.params;
  try {
    await approveWalletConnection(userId);

    res.status(200).json({
      data: null,
      success: true,
      message: "Connection complete",
    });
  } catch (error) {
    next(error);
  }
};

const suspendAccount = async (req, res, next) => {
  const { userId } = req.params;
  try {
    await suspendUser(userId);
    res.status(200).json({
      data: null,
      success: true,
      message: "Account suspended.",
    });
  } catch (error) {
    next(error);
  }
};

const removeUser = async (req, res, next) => {
  const { userId } = req.params;
  try {
    await deleteUser(userId);
    res.status(200).json({
      data: null,
      success: true,
      message: "Account deleted.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  reviewVerification,
  suspendAccount,
  removeUser,
  getUser,
  connectWallet,
  getVerifyData,
};
