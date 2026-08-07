const User = require("../../models/User");

const Usersetting = require("../../models/Usersetting");
const { CustomError } = require("../../utils/utils");
const { getCurrencyById } = require("../currencyService");
const {
  getCountryById,
  getStateById,
  getNationById,
} = require("../locationService");

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

  if (!userId) {
    throw new CustomError("Bad request", 400);
  }

  const settings = await Usersetting.findOne({ userId });

  if (!settings) {
    throw new CustomError("Settings not found", 404);
  }

  const parseLimit = (value) => {
    if (value === undefined) return undefined;
    if (value === "unlimited") return null;

    return Number(value);
  };

  if (bankMessage !== undefined) {
    settings.locks.bankDeposit.message = bankMessage;
  }

  if (cashMessage !== undefined) {
    settings.locks.cash.message = cashMessage;
  }

  const bankDepositMin = parseLimit(minBankDeposit);
  if (bankDepositMin !== undefined) {
    settings.limits.deposit.bank.min = bankDepositMin;
  }

  const bankDepositMax = parseLimit(maxBankDeposit);
  if (bankDepositMax !== undefined) {
    settings.limits.deposit.bank.max = bankDepositMax;
  }

  const cryptoDepositMin = parseLimit(minCryptoDeposit);
  if (cryptoDepositMin !== undefined) {
    settings.limits.deposit.crypto.min = cryptoDepositMin;
  }

  const cryptoDepositMax = parseLimit(maxCryptoDeposit);
  if (cryptoDepositMax !== undefined) {
    settings.limits.deposit.crypto.max = cryptoDepositMax;
  }

  const bankWithdrawalMin = parseLimit(minBankWithdrawal);
  if (bankWithdrawalMin !== undefined) {
    settings.limits.withdrawal.bank.min = bankWithdrawalMin;
  }

  const bankWithdrawalMax = parseLimit(maxBankWithdrawal);
  if (bankWithdrawalMax !== undefined) {
    settings.limits.withdrawal.bank.max = bankWithdrawalMax;
  }

  const cryptoWithdrawalMin = parseLimit(minCryptoWithdrawal);
  if (cryptoWithdrawalMin !== undefined) {
    settings.limits.withdrawal.crypto.min = cryptoWithdrawalMin;
  }

  const cryptoWithdrawalMax = parseLimit(maxCryptoWithdrawal);
  if (cryptoWithdrawalMax !== undefined) {
    settings.limits.withdrawal.crypto.max = cryptoWithdrawalMax;
  }

  await settings.save();

  return settings;
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
  try {
    const { userId, ...updates } = formData;

    const user = await User.findById(userId);
    if (!user) throw new CustomError("User not found!", 404);

    const setObject = {};

    if (updates.firstName)
      setObject["personalInfo.firstName"] = updates.firstName;

    if (updates.lastName) setObject["personalInfo.lastName"] = updates.lastName;

    if (updates.email) setObject["contactInfo.email"] = updates.email;

    if (updates.employment) setObject["employment.status"] = updates.employment;

    if (updates.experience)
      setObject["investmentInfo.experience"] = updates.experience;

    if (updates.address) setObject["contactInfo.street"] = updates.address;

    if (updates.city) setObject["contactInfo.city"] = updates.city;

    if (updates.zipCode) setObject["contactInfo.zipCode"] = updates.zipCode;

    if (updates.dob) {
      const formattedDob = new Date(updates.dob);

      if (isNaN(formattedDob.getTime())) {
        throw new CustomError("Invalid date format", 400);
      }

      setObject["personalInfo.dob"] = formattedDob;
    }

    if (updates.currencyId) {
      const currency = await getCurrencyById(updates.currencyId);
      if (!currency) throw new CustomError("Currency not found!", 404);

      setObject["currency"] = {
        id: currency._id,
        name: currency.name,
        symbol: currency.symbol,
        sign: currency.sign,
        rate: currency.rate,
      };
    }

    if (updates.countryId) {
      const country = await getCountryById(updates.countryId);
      if (!country) throw new CustomError("Country not found!", 404);

      setObject["contactInfo.country"] = {
        countryId: country._id,
        name: country.name,
        phoneCode: country.phoneCode,
      };
    }

    if (updates.stateId) {
      const state = await getStateById(updates.stateId);
      if (!state) throw new CustomError("State not found!", 404);

      setObject["contactInfo.state"] = {
        stateId: state._id,
        name: state.name,
      };
    }

    if (updates.nationalityId) {
      const nation = await getNationById(updates.nationalityId);
      if (!nation) throw new CustomError("Nationality not found!", 404);

      setObject["personalInfo.nationality"] = {
        id: nation._id,
        name: nation.name,
      };
    }

    if (Object.keys(setObject).length === 0) {
      return user;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: setObject },
      { new: true },
    );

    return updatedUser;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

module.exports = {
  configureUserInfo,
  configureBankDeposit,
  configureWalletAddress,
  configureUserLimits,
};
