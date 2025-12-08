const verifyService = require("../../services/user/verifyService");
const userService = require("../../services/user/userService");
const queueService = require("../../services/queueService");

const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;

const { generateFileName } = require("../../utils/utils");

const STORAGE_PATH = path.join(__dirname, "../../storage");
const PUBLIC_STORAGE_PATH = "/storage";

const submitDetails = async (req, res, next) => {
  const userId = req.user.userId;
  console.log(userId);

  try {
    const reqData = req.body;

    if (!req.files || req.files.length < 2) {
      return res.status(400).json({
        message: "Both front and back ID images are required.",
        success: false,
      });
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    const frontId = req.files[0];
    const backId = req.files[1];

    if (
      !allowedMimeTypes.includes(frontId.mimetype) ||
      !allowedMimeTypes.includes(backId.mimetype)
    ) {
      return res.status(400).json({
        message: "Only image files are allowed.",
        success: false,
      });
    }

    await fs.mkdir(STORAGE_PATH, { recursive: true });

    const frontFileName = generateFileName(
      frontId.originalname,
      "front",
      userId
    );
    const frontFilePath = path.join(STORAGE_PATH, frontFileName);

    await sharp(frontId.buffer)
      .resize(800, 600, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(frontFilePath);

    const backFileName = generateFileName(backId.originalname, "back", userId);
    const backFilePath = path.join(STORAGE_PATH, backFileName);

    await sharp(backId.buffer)
      .resize(800, 600, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(backFilePath);

    let frontIdPath = `${PUBLIC_STORAGE_PATH}/${frontFileName}`;
    let backIdPath = `${PUBLIC_STORAGE_PATH}/${backFileName}`;

    const userData = {
      ...reqData,
      userId: userId,
      frontId: frontIdPath,
      backId: backIdPath,
      frontIdName: frontFileName,
      backIdName: backFileName,
    };

    const isSubmitted = await verifyService.submitVerification(userData);

    if (!isSubmitted)
      return res
        .status(500)
        .json({ message: "Failed to submit.", success: false });

    res.status(200).json({
      message: "Verification request pending.",
      data: {
        frontId: frontIdPath,
        backId: backIdPath,
      },
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

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

module.exports = { verifyLoginCode, verifyEmailCode, submitDetails };
