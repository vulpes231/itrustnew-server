const { default: mongoose } = require("mongoose");
const Wallet = require("../../models/Wallet");
const { CustomError } = require("../../utils/utils");

class ManageWalletService {
  async getUserWallet(userId) {
    if (!userId) throw new CustomError("Wallet ID required!", 400);

    const userWallets = await Wallet.find({ userId });

    return userWallets;
  }

  async editWalletBalance(formData) {
    const { walletId, amount, action } = formData;

    if (!walletId || amount == null || !action) {
      throw new CustomError("Incomplete data!", 400);
    }

    if (!["add", "subtract"].includes(action)) {
      throw new CustomError("Invalid action!", 400);
    }

    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      throw new CustomError("Amount must be a valid positive number!", 400);
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const walletToUpdate = await Wallet.findById(walletId).session(session);

      if (!walletToUpdate) {
        throw new CustomError("Wallet not found!", 404);
      }

      if (action === "add") {
        walletToUpdate.balance.total += amt;
        walletToUpdate.balance.available += amt;
      } else {
        if (walletToUpdate.balance.available < amt) {
          throw new CustomError("Insufficient available balance!", 400);
        }

        walletToUpdate.balance.total -= amt;
        walletToUpdate.balance.available -= amt;
      }

      await walletToUpdate.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        balance: walletToUpdate.balance,
      };
    } catch (error) {
      await session.abortTransaction();

      throw new CustomError(
        error.message || "Unable to complete transaction!",
        error.statusCode || 500,
      );
    } finally {
      await session.endSession();
    }
  }
}

module.exports = new ManageWalletService();
