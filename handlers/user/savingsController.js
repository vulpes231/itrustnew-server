const queueService = require("../../services/queueService");
const {
  fetchAvailableSavings,
  addSavingsAccount,
  fetchUserSavingsHistory,
  fundSavings,
  withdrawSavings,
  fetchSavingsAnalytics,
  deleteUserSavingAccount,
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
    const result = await addSavingsAccount(userId, accountId);

    if (result.success && result.user.mailing.emailNotification) {
      await queueService.sendToQueue("email_queue", {
        type: "SAVINGS_CREATED_EMAIL",
        to: result.user.contactInfo.email,
        templateData: {
          account: result.account,
          user: result.user,
        },
      });
    }
    res.status(201).json({
      message: `${result.account.name} account opened successfully`,
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
    const result = await fundSavings(userId, fundData);
    if (result.success && result.user.mailing.emailNotification) {
      await queueService.sendToQueue("email_queue", {
        type: "CONTRIBUTION_EMAIL",
        to: result.user.contactInfo.email,
        templateData: {
          transaction: result.transaction,
          user: result.user,
        },
      });
    }
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
    const result = await withdrawSavings(userId, withdrawData);
    if (result.success && result.user.mailing.emailNotification) {
      await queueService.sendToQueue("email_queue", {
        type: "CASHOUT_REQUEST_EMAIL",
        to: result.user.contactInfo.email,
        templateData: {
          transaction: result.transaction,
          user: result.user,
        },
      });
    }
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

const removeUserSavingsAccounts = async (req, res, next) => {
  const { userId } = req.user;
  const { accountId } = req.params;
  try {
    const accounts = await deleteUserSavingAccount({ userId, accountId });
    res.status(200).json({
      message: "Savings account deleted successfully",
      data: accounts,
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
  removeUserSavingsAccounts,
};
