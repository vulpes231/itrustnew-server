const verifyService = require("../../services/user/verifyService");
const userService = require("../../services/user/userService");
const queueService = require("../../services/queueService");

const verifyLoginCode = async (req, res, next) => {
  const authData = req.body;
  try {
    const { refreshToken, accessToken, userInfo } =
      await verifyService.authUser(authData);
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 60 * 30,
    });
    res.status(200).json({
      message: "Login authenticated",
      token: accessToken,
      data: userInfo,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmailCode = async (req, res, next) => {
  const { code } = req.body;
  const userId = req.user.userId;
  try {
    const verifyData = { code, userId };
    const emailVerified = await verifyService.verifyMail(verifyData);

    if (emailVerified) {
      const user = await userService.getUserById(userId);
      await queueService.sendToQueue("email_queue", {
        type: "WELCOME_EMAIL",
        to: user.credentials.email,
        templateData: {
          name: user.credentials.username,
          email: user.credentials.email,
        },
      });
    }

    res
      .status(200)
      .json({ message: "Email verified.", success: true, data: null });
  } catch (error) {
    next(error);
  }
};

const approveAccount = async (req, res, next) => {};

module.exports = { verifyLoginCode, verifyEmailCode };
