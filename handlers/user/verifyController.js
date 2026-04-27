const verifyService = require("../../services/user/verifyService");
const userService = require("../../services/user/userService");
const queueService = require("../../services/queueService");

const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;

const { generateFileName, allowedMimeTypes } = require("../../utils/utils");
const User = require("../../models/User");

const ID_PUBLIC_STORAGE_PATH = "/storage/accounts";
const PROOF_PUBLIC_STORAGE_PATH = "/storage/proofs";

const submitDetails = async (req, res, next) => {
  const ID_STORAGE_PATH = path.join(__dirname, "../../storage/accounts");
  const userId = req.user.userId;

  try {
    const reqData = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "Main ID image is required.",
        success: false,
      });
    }

    const frontId = req.files[0];
    const backId = req.files[1];

    if (!allowedMimeTypes.includes(frontId.mimetype)) {
      return res.status(400).json({
        message: "Front ID must be an image.",
        success: false,
      });
    }

    if (backId && !allowedMimeTypes.includes(backId.mimetype)) {
      return res.status(400).json({
        message: "Back ID must be an image.",
        success: false,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found!",
        success: false,
      });
    }

    if (user.identityVerification.kycStatus === "pending") {
      return res.status(400).json({
        message: "Verification in progress!",
        success: false,
      });
    }
    if (user.identityVerification.kycStatus === "approved") {
      return res.status(400).json({
        message: "Verification completed!",
        success: false,
      });
    }

    await fs.mkdir(ID_STORAGE_PATH, { recursive: true });

    const frontFileName = generateFileName(
      frontId.originalname,
      "front",
      userId,
    );
    const frontFilePath = path.join(ID_STORAGE_PATH, frontFileName);

    await sharp(frontId.buffer)
      .resize(800, 600, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(frontFilePath);

    let frontIdPath = `${ID_PUBLIC_STORAGE_PATH}/${frontFileName}`;

    let backIdPath = null;
    let backFileName = null;

    if (backId) {
      backFileName = generateFileName(backId.originalname, "back", userId);

      const backFilePath = path.join(ID_STORAGE_PATH, backFileName);

      await sharp(backId.buffer)
        .resize(800, 600, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(backFilePath);

      backIdPath = `${ID_PUBLIC_STORAGE_PATH}/${backFileName}`;
    }

    const userData = {
      ...reqData,
      userId: userId,
      frontId: frontIdPath,
      backId: backIdPath,
      frontIdName: frontFileName,
      backIdName: backFileName,
    };

    const isSubmitted = await verifyService.submitVerification(userData);

    if (!isSubmitted) {
      return res.status(500).json({
        message: "Failed to submit.",
        success: false,
      });
    }

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

const verifyAddress = async (req, res, next) => {
  const PROOF_STORAGE_PATH = path.join(__dirname, "../../storage/proofs");
  const userId = req.user.userId;

  try {
    const reqData = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "Proof of address image is required.",
        success: false,
      });
    }

    const proof = req.files[0];

    if (!allowedMimeTypes.includes(proof.mimetype)) {
      return res.status(400).json({
        message: "Proof of address must be an image.",
        success: false,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found!",
        success: false,
      });
    }

    if (!user.contactInfo || user.contactInfo.status === "pending") {
      return res.status(400).json({
        message: "Verification in progress!",
        success: false,
      });
    }
    if (user.contactInfo.status === "verified") {
      return res.status(400).json({
        message: "Verification completed!",
        success: false,
      });
    }

    await fs.mkdir(PROOF_STORAGE_PATH, { recursive: true });

    const proofFilename = generateFileName(proof.originalname, "proof", userId);
    const proofFilePath = path.join(PROOF_STORAGE_PATH, proofFilename);

    await sharp(proof.buffer)
      .resize(800, 600, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(proofFilePath);

    let imageUrl = `${PROOF_PUBLIC_STORAGE_PATH}/${proofFilename}`;

    const userData = {
      ...reqData,
      userId: userId,
      docPath: imageUrl,
    };

    await verifyService.submitAddressProof(userData);

    res.status(200).json({
      message: "Address verification request pending.",
      data: null,
      success: true,
    });
  } catch (error) {
    console.log(error);
    await fs.unlink(proofFilePath);
    next(error);
  }
};

const verifyLoginCode = async (req, res, next) => {
  const { email, code } = req.body;
  try {
    const { refreshToken, accessToken, userInfo } =
      await verifyService.authUser({ email, code });
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
        to: user.contactInfo.email,
        templateData: {
          name: user.personalInfo.username,
          email: user.contactInfo.email,
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

module.exports = {
  verifyLoginCode,
  verifyEmailCode,
  submitDetails,
  verifyAddress,
};
