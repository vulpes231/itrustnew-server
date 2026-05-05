const {
  fetchUserWallets,
  getUserFinancialSummary,
  getWalletInvestData,
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

module.exports = {
  getUserWallets,
  getWalletAnalytics,
  getAccountsInvestmentData,
};
