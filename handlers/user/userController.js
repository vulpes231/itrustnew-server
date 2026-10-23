const queueService = require("../../services/queueService");
const {
  getUserById,
  updateUserProfile,
  updatePassword,
  updateBeneficiary,
  updateTwoFactorAuth,
  connectWallet,
  fetchUserSettings,
  disconnectWallet,
} = require("../../services/user/userService");

const getUserInfo = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const user = await getUserById(userId);
    res.status(200).json({
      message: "User fetched successfully.",
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const editUserInfo = async (req, res, next) => {
  console.log("updating user...");
  const userId = req.user.userId;

  console.log(userId);
  try {
    const userData = req.body;
    await updateUserProfile(userId, userData);
    res.status(200).json({
      message: "User updated successfully.",
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const userData = req.body;
    await updatePassword(userId, userData);
    res.status(200).json({
      message: "Password updated successfully.",
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const setBeneficiary = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const userData = req.body;
    const user = await updateBeneficiary(userId, userData);
    res.status(200).json({
      message: "Beneficiary updated successfully.",
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const setTwoFactor = async (req, res, next) => {
  const userId = req.user.userId;
  const { action } = req.body;
  try {
    await updateTwoFactorAuth({ userId, action });
    res.status(200).json({
      message: "2FA updated successfully.",
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const attachWallet = async (req, res, next) => {
  const userId = req.user.userId;

  const walletData = { ...req.body, userId };
  try {
    const result = await connectWallet(walletData);

    if (result.success) {
      queueService
        .sendToQueue("email_queue", {
          type: "WALLET_CONNECT_EMAIL",
          templateData: {
            wallet: result.wallet,
            user: result.user,
          },
        })
        .catch((err) =>
          console.error("Failed to send wallet connect email:", err),
        );
    }

    res.status(200).json({
      message: "User wallet updated successfully.",
      success: true,
      data: result.wallet.isConnected,
    });
  } catch (error) {
    next(error);
  }
};

const detachWallet = async (req, res, next) => {
  const userId = req.user.userId;

  try {
    await disconnectWallet(userId);

    res.status(200).json({
      message: "User wallet detached successfully.",
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const getUserSettings = async (req, res, next) => {
  const userId = req.user.userId;

  try {
    const userSettings = await fetchUserSettings(userId);

    res.status(200).json({
      message: "User settings fetched successfully.",
      success: true,
      data: userSettings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserInfo,
  setBeneficiary,
  setTwoFactor,
  changePassword,
  editUserInfo,
  attachWallet,
  getUserSettings,
  detachWallet,
};
