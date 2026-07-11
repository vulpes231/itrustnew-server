const {
  fetchAllTransactions,
  getTransactionInfo,
  editTransaction,
  createTransaction,
  updateTransactionStatus,
  editTransactionInfo,
} = require("../../services/admin/manageTransactionService");
const queueService = require("../../services/queueService");

const getTransactionData = async (req, res, next) => {
  const { transactionId } = req.params;
  try {
    const transaction = await getTransactionInfo(transactionId);
    res.status(200).json({
      data: transaction,
      success: true,
      message: "transaction data fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

const setTransactionStatus = async (req, res, next) => {
  const { transactionId } = req.params;
  const { status } = req.body;
  try {
    const data = { transactionId, status };
    const transaction = await updateTransactionStatus(data);
    res.status(200).json({
      data: transaction,
      success: true,
      message: "transaction status updated fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getAllTransactions = async (req, res, next) => {
  const sortBy = req.query.sortBy;
  const limit = Math.min(req.query.limit || 15);
  const page = Math.max(req.query.page || 1);
  const filterBy = req.query.filterBy;
  try {
    const { transactions, totalTrnxs, totalPages, currentPage } =
      await fetchAllTransactions({
        sortBy,
        limit,
        page,
        filterBy,
      });
    res.status(200).json({
      data: transactions,
      success: true,
      message: "transactions fetched successfully",
      pagination: {
        totalPage: totalPages,
        totalItem: totalTrnxs,
        currentPage: currentPage,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateTransaction = async (req, res, next) => {
  const { transactionId } = req.params;
  const { action } = req.body;

  try {
    const result = await editTransaction(transactionId, action);

    if (
      result.success &&
      result.userInfo.sendAlert &&
      result.transaction.type === "deposit"
    ) {
      queueService
        .sendToQueue("email_queue", {
          type: "DEPOSIT_EMAIL",
          to: result.userInfo.email,
          templateData: {
            transaction: result.transaction,
            currency: result.userInfo.currency,
          },
        })
        .catch((err) => console.error("Failed to send deposit email:", err));
    }

    if (
      result.success &&
      result.userInfo.sendAlert &&
      result.transaction.type === "withdraw"
    ) {
      queueService
        .sendToQueue("email_queue", {
          type: "WITHDRAW_EMAIL",
          to: result.userInfo.email,
          templateData: {
            transaction: result.transaction,
            currency: result.userInfo.currency,
          },
        })
        .catch((err) => console.error("Failed to send withdrawal email:", err));
    }
    res.status(200).json({
      data: null,
      success: true,
      message: "transaction updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

const adminCreateTransaction = async (req, res, next) => {
  try {
    const trnxData = req.body;

    const result = await createTransaction(trnxData);

    if (result.success && trnxData.notifyUser && trnxData.type !== "transfer") {
      await queueService.sendToQueue("email_queue", {
        type: trnxData.type === "deposit" ? "DEPOSIT_EMAIL" : "WITHDRAW_EMAIL",
        to: result.email,
        templateData: {
          transaction: result.transaction,
          currency: result.transaction.method.mode,
        },
      });
    }
    res.status(200).json({
      message: `${req.body.type} created`,
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const updateTransactionInfo = async (req, res, next) => {
  const { transactionId } = req.params;
  const { customDate } = req.body;

  try {
    await editTransactionInfo({ transactionId, customDate });

    res.status(200).json({
      data: null,
      success: true,
      message: "transaction updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateTransaction,
  getAllTransactions,
  getTransactionData,
  adminCreateTransaction,
  setTransactionStatus,
  updateTransactionInfo,
};
