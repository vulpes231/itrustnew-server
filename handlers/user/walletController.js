const {
  fetchUserWallets,
  getUserFinancialSummary,
  getWalletInvestData,
  fetchPortfolioAccounts,
  fetchTradingAccounts,
  calculateNetworth,
} = require("../../services/user/walletService");

const getUserWallets = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const userWallets = await fetchUserWallets(userId);
    res.status(200).json({
      message: "User wallets fetched succesfully",
      data: userWallets,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getWalletAnalytics = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const walletAnalytics = await getUserFinancialSummary(userId);
    // console.log(walletAnalytics);
    res.status(200).json({
      message: "User analytics fetched succesfully",
      data: walletAnalytics,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getAccountsInvestmentData = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const accountData = await getWalletInvestData(userId);
    // console.log(accountData);
    res.status(200).json({
      message: "User analytics fetched succesfully",
      data: accountData,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getPortfolioAccounts = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const accounts = await fetchPortfolioAccounts(userId);

    res.status(200).json({
      message: "Portfolio accounts fetched succesfully",
      data: accounts,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getTradingAccounts = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const accounts = await fetchTradingAccounts(userId);

    res.status(200).json({
      message: "Trading accounts fetched succesfully",
      data: accounts,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const getUserNetworth = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const networth = await calculateNetworth(userId);

    res.status(200).json({
      message: "User networth fetched succesfully",
      data: networth,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserWallets,
  getWalletAnalytics,
  getAccountsInvestmentData,
  getPortfolioAccounts,
  getTradingAccounts,
  getUserNetworth,
};
