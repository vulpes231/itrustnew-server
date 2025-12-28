const {
  fetchAvailableSavings,
  addSavingsAccount,
  fetchUserSavingsHistory,
  fundSavings,
  withdrawSavings,
  fetchSavingsAnalytics,
} = require("../../services/user/savingsService");

const getSavingsAccounts = async (req, res, next) => {
  try {
    const accounts = await fetchAvailableSavings();
    res.status(200).json({
      message: "Savings account fetched successfully",
      data: accounts,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const createSavingsAccounts = async (req, res, next) => {
  const userId = req.user.userId;
  const { accountId } = req.body;
  try {
    const acctName = await addSavingsAccount(userId, accountId);
    res.status(201).json({
      message: `${acctName} account opened successfully`,
      data: null,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getSavingsHistory = async (req, res, next) => {
  const userId = req.user.userId;
  const limit = Math.min(50, parseInt(req.query.limit) || 15);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const sortBy = req.query.sortBy;
  try {
    const { savingsHistory, totalPage, totalItem, currentPage } =
      await fetchUserSavingsHistory(userId, {
        page,
        limit,
        sortBy,
      });
    res.status(200).json({
      message: `Savings history fetched`,
      data: savingsHistory,
      success: true,
      pagination: {
        currentPage,
        totalResult: totalItem,
        totalPages: totalPage,
      },
    });
  } catch (error) {
    next(error);
  }
};

const contributeSavings = async (req, res, next) => {
  const userId = req.user.userId;
  const fundData = req.body;
  try {
    await fundSavings(userId, fundData);
    res.status(200).json({
      message: `Contribution successful`,
      data: null,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const cashoutSavings = async (req, res, next) => {
  const userId = req.user.userId;
  const withdrawData = req.body;
  try {
    const acctName = await withdrawSavings(userId, withdrawData);
    res.status(200).json({
      message: `Cashout successful`,
      data: null,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getSavingAnalytics = async (req, res, next) => {
  const userId = req.user.userId;

  try {
    const savingAnalytics = await fetchSavingsAnalytics(userId);
    res.status(200).json({
      message: `Saving Accounts Analytics Fetched Successfully.`,
      data: savingAnalytics,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  cashoutSavings,
  contributeSavings,
  getSavingsHistory,
  getSavingsAccounts,
  createSavingsAccounts,
  getSavingAnalytics,
};
