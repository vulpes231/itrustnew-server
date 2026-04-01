const {
  addFunds,
  withdrawFunds,
  moveFunds,
  getUserLedger,
  cancelTransaction,
  getUserTrnxAnalytics,
} = require("../../services/user/transactionService");
const { allowedMimeTypes } = require("../../utils/utils");

const deposit = async (req, res, next) => {
  const userId = req.user.userId;

  try {
    const trnxData = req.body;

    let proofUrl = null;

    if (trnxData.method === "bank") {
      if (!req.file) {
        return res.status(400).json({
          message: "Payment proof is required for bank deposits.",
          success: false,
        });
      }

      const file = req.file;

      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: "Only image files are allowed.",
          success: false,
        });
      }

      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return res.status(400).json({
          message: "File too large. Max 5MB allowed.",
          success: false,
        });
      }

      const STORAGE_PATH = path.join(__dirname, "../../storage/deposits");
      await fs.promises.mkdir(STORAGE_PATH, { recursive: true });

      const filename = `${userId}-deposit-${Date.now()}.webp`;
      const filePath = path.join(STORAGE_PATH, filename);

      await sharp(file.buffer)
        .resize(800, 600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filePath);

      proofUrl = `/storage/deposits/${filename}`;
    }

    await addFunds(userId, { ...trnxData, proofUrl });

    res.status(200).json({
      message: "Deposit initiated.",
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const withdraw = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const trnxData = req.body;
    await withdrawFunds(userId, trnxData);
    res
      .status(200)
      .json({ message: "Withdrawal initiated.", success: true, data: null });
  } catch (error) {
    next(error);
  }
};

const transfer = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const trnxData = req.body;
    await moveFunds(userId, trnxData);
    res
      .status(200)
      .json({ message: "Transfer completed.", success: true, data: null });
  } catch (error) {
    next(error);
  }
};

const getTransactionHistory = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const transactions = await getUserLedger(userId);
    res.status(200).json({ data: transactions, success: true });
  } catch (error) {
    next(error);
  }
};

const stopTransaction = async (req, res, next) => {
  const { transactionId } = req.body;
  try {
    await cancelTransaction(transactionId);
    res.status(200).json({ message: "Transaction cancelled.", success: true });
  } catch (error) {
    next(error);
  }
};

const getTransactionAnalytics = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const trnxAnalytics = await getUserTrnxAnalytics(userId);
    res.status(200).json({ data: trnxAnalytics, success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  deposit,
  withdraw,
  transfer,
  getTransactionHistory,
  stopTransaction,
  getTransactionAnalytics,
};
