const WalletSetting = require("../../models/Walletsetting");
const { CustomError } = require("../../utils/utils");

async function createSettings(data) {
  const {
    btc,
    eth,
    usdtTrc,
    usdtErc,
    accountName,
    accountNumber,
    routing,
    reference,
    address,
  } = data;
  try {
    const newData = {
      cryptoWallets: {
        btc: btc,
        eth: eth,
        usdtTrc: usdtTrc,
        usdtErc: usdtErc,
      },
      bankDetails: {
        accountName: accountName,
        accountNumber: accountNumber,
        routing: routing,
        reference: reference,
        address: address,
      },
    };
    const settings = await WalletSetting.findOne({ name: "global" });
    if (!settings) {
      await WalletSetting.create(newData);
    }
    return true;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

async function editBank(data) {
  const { accountName, accountNumber, routing, reference, address, bankName } =
    data;
  try {
    const settings = await WalletSetting.findOne({ name: "global" });

    if (accountName) settings.bankDetails.accountName = accountName;
    if (accountNumber) settings.bankDetails.accountNumber = accountNumber;
    if (reference) settings.bankDetails.reference = reference;
    if (routing) settings.bankDetails.routing = routing;
    if (address) settings.bankDetails.address = address;
    if (bankName) settings.bankDetails.bankName = bankName;

    await settings.save();
    return settings;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

async function editWallets(data) {
  const { btc, eth, usdtTrc, usdtErc } = data;
  try {
    const settings = await WalletSetting.findOne({ name: "global" });

    if (btc) settings.cryptoWallets.btc = btc;
    if (eth) settings.cryptoWallets.eth = eth;
    if (usdtTrc) settings.cryptoWallets.usdtTrc = usdtTrc;
    if (usdtErc) settings.cryptoWallets.usdtErc = usdtErc;

    await settings.save();
    return settings;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

async function editLimit(data) {
  const {
    minCryptoDeposit,
    minBankDeposit,
    maxCryptoDeposit,
    maxBankDeposit,
    minCryptoWithdrawal,
    minBankWithdrawal,
    maxCryptoWithdrawal,
    maxBankWithdrawal,
  } = data;

  const parseLimit = (value) => {
    if (value === undefined) return undefined;
    if (value === "unlimited") return null;

    return Number(value);
  };

  const settings = await WalletSetting.findOne({ name: "global" });

  if (!settings) {
    throw new CustomError("Wallet settings not found.", 404);
  }

  const cryptoDepositMin = parseLimit(minCryptoDeposit);
  if (cryptoDepositMin !== undefined) {
    settings.depositLimits.crypto.min = cryptoDepositMin;
  }

  const cryptoDepositMax = parseLimit(maxCryptoDeposit);
  if (cryptoDepositMax !== undefined) {
    settings.depositLimits.crypto.max = cryptoDepositMax;
  }

  const bankDepositMin = parseLimit(minBankDeposit);
  if (bankDepositMin !== undefined) {
    settings.depositLimits.bank.min = bankDepositMin;
  }

  const bankDepositMax = parseLimit(maxBankDeposit);
  if (bankDepositMax !== undefined) {
    settings.depositLimits.bank.max = bankDepositMax;
  }

  const cryptoWithdrawalMin = parseLimit(minCryptoWithdrawal);
  if (cryptoWithdrawalMin !== undefined) {
    settings.withdrawalLimits.crypto.min = cryptoWithdrawalMin;
  }

  const cryptoWithdrawalMax = parseLimit(maxCryptoWithdrawal);
  if (cryptoWithdrawalMax !== undefined) {
    settings.withdrawalLimits.crypto.max = cryptoWithdrawalMax;
  }

  const bankWithdrawalMin = parseLimit(minBankWithdrawal);
  if (bankWithdrawalMin !== undefined) {
    settings.withdrawalLimits.bank.min = bankWithdrawalMin;
  }

  const bankWithdrawalMax = parseLimit(maxBankWithdrawal);
  if (bankWithdrawalMax !== undefined) {
    settings.withdrawalLimits.bank.max = bankWithdrawalMax;
  }

  await settings.save();

  return settings;
}

async function fetchGlobalSettings() {
  try {
    const settings = await WalletSetting.findOne({ name: "global" });
    return settings;
  } catch (error) {
    throw new CustomError(
      error.message || "Failed to fetch settings",
      error.statusCode || 500,
    );
  }
}

module.exports = {
  createSettings,
  editBank,
  editLimit,
  editWallets,
  fetchGlobalSettings,
};
