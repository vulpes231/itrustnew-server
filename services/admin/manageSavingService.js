const { default: mongoose } = require("mongoose");
const SavingsAccount = require("../../models/Savingsaccount");
const { CustomError } = require("../../utils/utils");
const { fetchAvailableSavings } = require("../user/savingsService");

async function newSavingsAccount(accountData) {
  console.log("Correct Add Savings api");
  const {
    name,
    title,
    notes,
    symbol,
    subTitle,
    category,
    canTrade,
    interestRate,
    minDeposit,
    maxDeposit,
    minWithdrawal,
    maxWithdrawal,
    eligibleCountries,
  } = accountData;

  console.log(accountData);

  if (
    !name ||
    !title ||
    !notes ||
    !subTitle ||
    !canTrade ||
    !category ||
    !symbol ||
    !interestRate ||
    !eligibleCountries ||
    !Array.isArray(eligibleCountries)
  ) {
    throw new CustomError("Missing required fields", 400);
  }

  if (!eligibleCountries.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    throw new CustomError("Invalid country ID format", 400);
  }

  if (
    (minDeposit !== undefined && (isNaN(minDeposit) || minDeposit < 0)) ||
    (maxDeposit !== undefined && (isNaN(maxDeposit) || maxDeposit < 0)) ||
    (minWithdrawal !== undefined &&
      (isNaN(minWithdrawal) || minWithdrawal < 0)) ||
    (maxWithdrawal !== undefined && (isNaN(maxWithdrawal) || maxWithdrawal < 0))
  ) {
    throw new CustomError("Invalid numeric values for limits", 400);
  }

  try {
    const acctExists = await SavingsAccount.findOne({ name });
    if (acctExists) throw new CustomError("Account already exist!", 409);

    const newAccount = {
      name,
      title,
      note: notes,
      interestRate,
      symbol,
      subTitle,
      canTrade,
      category,
      contributionLimits: {
        min: minDeposit ?? 1,
        max: maxDeposit ?? 1000,
      },
      withdrawalLimits: {
        min: minWithdrawal ?? 1,
        max: maxWithdrawal ?? 1000,
      },
      eligibleCountries,
    };

    const savedAccount = await SavingsAccount.create(newAccount);
    return savedAccount;
  } catch (error) {
    if (error.code === 11000) {
      throw new CustomError("Account name already exists", 400);
    }
    throw new CustomError(error.message, 500);
  }
}

async function editSavingsAccount(accountData) {
  const {
    accountId,
    name,
    title,
    note,
    interestRate,
    minDeposit,
    maxDeposit,
    minWithdrawal,
    maxWithdrawal,
    eligibleCountries, // Now expects { add: [], remove: [] }
    status,
  } = accountData;

  // Validate required ID
  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) {
    throw new CustomError("Invalid or missing account ID", 400);
  }

  // Check if account exists
  const existingAccount = await SavingsAccount.findById(accountId);
  if (!existingAccount) {
    throw new CustomError("Savings account not found", 404);
  }

  // Validate provided fields
  if (
    (name !== undefined && !name) ||
    (title !== undefined && !title) ||
    (note !== undefined && !note) ||
    (interestRate !== undefined &&
      (!interestRate ||
        isNaN(interestRate) ||
        interestRate < 0 ||
        interestRate > 100))
  ) {
    throw new CustomError("Invalid or missing required fields", 400);
  }

  // Validate eligibleCountries
  if (eligibleCountries) {
    if (
      (!eligibleCountries.add || !Array.isArray(eligibleCountries.add)) &&
      (!eligibleCountries.remove || !Array.isArray(eligibleCountries.remove))
    ) {
      throw new CustomError(
        "Invalid eligibleCountries format; must include add or remove arrays",
        400
      );
    }
    if (
      (eligibleCountries.add &&
        !eligibleCountries.add.every((id) =>
          mongoose.Types.ObjectId.isValid(id)
        )) ||
      (eligibleCountries.remove &&
        !eligibleCountries.remove.every((id) =>
          mongoose.Types.ObjectId.isValid(id)
        ))
    ) {
      throw new CustomError("Invalid country ID format", 400);
    }
  }

  // Validate numeric fields
  if (
    (minDeposit !== undefined && (isNaN(minDeposit) || minDeposit < 0)) ||
    (maxDeposit !== undefined && (isNaN(maxDeposit) || maxDeposit < 0)) ||
    (minWithdrawal !== undefined &&
      (isNaN(minWithdrawal) || minWithdrawal < 0)) ||
    (maxWithdrawal !== undefined && (isNaN(maxWithdrawal) || maxWithdrawal < 0))
  ) {
    throw new CustomError("Invalid numeric values for limits", 400);
  }

  // Validate status if provided
  if (status !== undefined && !["active", "inactive"].includes(status)) {
    throw new CustomError("Invalid status value", 400);
  }

  try {
    const updateData = {
      $set: {
        ...(name && { name }),
        ...(title && { title }),
        ...(note && { note }),
        ...(interestRate !== undefined && { interestRate }),
        ...(status && { status }),
        ...(minDeposit !== undefined && {
          "contributionLimits.min": minDeposit,
        }),
        ...(maxDeposit !== undefined && {
          "contributionLimits.max": maxDeposit,
        }),
        ...(minWithdrawal !== undefined && {
          "withdrawalLimits.min": minWithdrawal,
        }),
        ...(maxWithdrawal !== undefined && {
          "withdrawalLimits.max": maxWithdrawal,
        }),
      },
      ...(eligibleCountries?.add && {
        $addToSet: { eligibleCountries: { $each: eligibleCountries.add } },
      }),
      ...(eligibleCountries?.remove && {
        $pull: { eligibleCountries: { $in: eligibleCountries.remove } },
      }),
    };

    const updatedAccount = await SavingsAccount.findByIdAndUpdate(
      accountId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedAccount) {
      throw new CustomError("Failed to update savings account", 500);
    }

    return updatedAccount;
  } catch (error) {
    if (error.code === 11000) {
      throw new CustomError("Account name already exists", 400);
    }
    throw new CustomError(error.message, 500);
  }
}

async function deleteSavingsAccount(accountData) {
  const { accountId } = accountData;

  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) {
    throw new CustomError("Invalid or missing account ID", 400);
  }

  try {
    const deletedAccount = await SavingsAccount.findByIdAndDelete(accountId);
    if (!deletedAccount) {
      throw new CustomError("Savings account not found", 404);
    }
    return true;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function fetchAllSavingsAccount() {
  try {
    const savingsAccts = await fetchAvailableSavings();
    if (!savingsAccts) {
      throw new CustomError("Savings account not found", 404);
    }
    return savingsAccts;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function getSavingAccountInfo(accountId) {
  try {
    const account = await SavingsAccount.findById(accountId);
    if (!account) {
      throw new CustomError("Account not found!", 404);
    }
    return account;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

module.exports = {
  newSavingsAccount,
  editSavingsAccount,
  deleteSavingsAccount,
  fetchAllSavingsAccount,
  getSavingAccountInfo,
};
