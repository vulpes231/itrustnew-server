const queueService = require("../services/queueService");
const resetAccountPassService = require("../services/resetAccontPassService");

const sendPassResetOtp = async (req, res, next) => {
  const { email } = req.body;

  try {
    await queueService.sendToQueue("email_queue", {
      type: "VERIFICATION_EMAIL",
      to: email,
      subject: "Confirm Your Password Reset - Itrust Investment",
    });

    res.status(200).json({
      message: "Password reset code sent.",
      data: null,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const confirmPassResetOtp = async (req, res, next) => {
  const { email, code } = req.body;

  try {
    const resetPassToken = await resetAccountPassService.confirmEmailOwnership({
      email,
      code,
    });

    res.status(200).json({
      message: "Account ownership confirmed.",
      data: null,
      success: true,
      token: resetPassToken,
    });
  } catch (error) {
    next(error);
  }
};

const updateAccountPass = async (req, res, next) => {
  const { newPass, oldPass } = req.body;

  try {
    const { userId } = req.user;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { message } = await resetAccountPassService.changeAccountPass({
      newPass,
      oldPass,
      userId,
    });

    res.status(200).json({
      message: message,
      data: null,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { updateAccountPass, sendPassResetOtp, confirmPassResetOtp };
