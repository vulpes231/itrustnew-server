const authService = require("../../services/user/authService");
const queueService = require("../../services/queueService");

const registerUser = async (req, res, next) => {
  if (!req.body) return res.status(400).json({ message: "Bad request!" });

  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email Required!" });

  try {
    const userData = req.body;

    const { userInfo, accessToken, refreshToken } =
      await authService.registerService(userData);

    await queueService.sendToQueue("email_queue", {
      type: "VERIFICATION_EMAIL",
      to: email,
    });

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 60 * 30,
    });

    res.status(201).json({
      message: `${userInfo.credentials.username} created successfully.`,
      success: true,
      data: userInfo,
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  if (!req.body) return res.status(400).json({ message: "Bad request!" });
  try {
    const loginData = req.body;
    const { accessToken, refreshToken, userInfo } =
      await authService.loginService(loginData);

    if (userInfo.accountStatus.twoFaActivated) {
      res.status(200).json({
        message: `Verify login.`,
        token: null,
        userInfo,
        otp: userInfo.accountStatus.otp,
      });
    } else {
      res.cookie("jwt", refreshToken, {
        httpOnly: true,
        secure: true,
        maxAge: 1000 * 60 * 60 * 30,
      });

      res.status(200).json({
        message: `Login successfully.`,
        token: accessToken,
        data: userInfo,
        success: true,
      });
    }
  } catch (error) {
    next(error);
  }
};

const logoutUser = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const loggedOut = await authService.logoutService(userId);
    if (loggedOut) {
      res.clearCookie("jwt", {
        httpOnly: true,
        secure: true,
        maxAge: 1000 * 60 * 60 * 30,
      });
    }
    res
      .status(200)
      .json({ message: "Logout successful.", success: true, data: null });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerUser, loginUser, logoutUser };
