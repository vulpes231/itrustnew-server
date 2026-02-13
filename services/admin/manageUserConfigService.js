const User = require("../../models/User");

const Usersetting = require("../../models/Usersetting");
const { CustomError } = require("../../utils/utils");

async function configureUserLimits(formData) {
  const {
    bankMessage,
    cashMessage,
    maxBankDeposit,
    maxBankWithdrawal,
    maxCryptoDeposit,
    maxCryptoWithdrawal,
    minBankDeposit,
    minBankWithdrawal,
    minCryptoDeposit,
    minCryptoWithdrawal,
    userId,
  } = formData;
  try {
    if (!userId) throw new CustomError("Bad request", 400);

    const settings = await Usersetting.findOne({ userId });
    if (!settings) throw new CustomError("Settings not found", 404);

    if (bankMessage) settings.locks.bankDeposit.message = bankMessage;
    if (cashMessage) settings.locks.cash.message = cashMessage;
    if (minBankDeposit) settings.limits.deposit.bank.min = minBankDeposit;
    if (maxBankDeposit) settings.limits.deposit.bank.max = maxBankDeposit;
    if (minCryptoDeposit) settings.limits.deposit.crypto.min = minCryptoDeposit;
    if (maxCryptoDeposit) settings.limits.deposit.crypto.max = maxCryptoDeposit;
    if (minBankWithdrawal)
      settings.limits.withdrawal.bank.min = minBankWithdrawal;
    if (maxBankWithdrawal)
      settings.limits.withdrawal.bank.max = maxBankWithdrawal;
    if (minCryptoWithdrawal)
      settings.limits.withdrawal.crypto.min = minCryptoWithdrawal;
    if (maxCryptoWithdrawal)
      settings.limits.withdrawal.crypto.max = maxCryptoWithdrawal;

    await settings.save();
    return settings;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function configureBankDeposit(formData) {
  const {
    userId,
    bankName,
    accountNumber,
    routing,
    address,
    reference,
    accountName,
  } = formData;
  try {
    if (!userId) throw new CustomError("Bad request", 400);

    const settings = await Usersetting.findOne({ userId });
    if (!settings) throw new CustomError("Settings not found", 404);

    if (bankName) settings.bankDetails.bankName = bankName;
    if (accountName) settings.bankDetails.accountName = accountName;
    if (accountNumber) settings.bankDetails.accountNumber = accountNumber;
    if (routing) settings.bankDetails.routing = routing;
    if (address) settings.bankDetails.address = address;
    if (reference) settings.bankDetails.reference = reference;

    await settings.save();
    return settings;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function configureWalletAddress(formData) {
  const { userId, btc, eth, usdtTrc, usdtErc } = formData;
  try {
    if (!userId) throw new CustomError("Bad request", 400);

    const settings = await Usersetting.findOne({ userId });
    if (!settings) throw new CustomError("Settings not found", 404);

    if (btc) settings.cryptoWallets.btc = btc;
    if (eth) settings.cryptoWallets.eth = eth;
    if (usdtErc) settings.cryptoWallets.usdtErc = usdtErc;
    if (usdtTrc) settings.cryptoWallets.usdtTrc = usdtTrc;

    await settings.save();
    return settings;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function configureUserInfo(formData) {
  const {
    firstname,
    lastname,
    email,
    address,
    countryId,
    stateId,
    city,
    zipCode,
    dob,
    experience,
    currencyId,
    employment,
    nationalityId,
    userId,
  } = formData;
  try {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("User not found!", 404);
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

module.exports = {
  configureUserInfo,
  configureBankDeposit,
  configureWalletAddress,
  configureUserLimits,
};
