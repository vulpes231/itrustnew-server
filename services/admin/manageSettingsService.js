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
  const { method, type, min, max } = data;

  if (!method || !type || !min || !max)
    throw new CustomError("Bad request", 400);
  try {
    const settings = await WalletSetting.findOne({ name: "global" });

    if (method === "deposit") {
      if (type === "bank") {
        settings.depositLimits.bank.min = min;
        settings.depositLimits.bank.max = max;
        await settings.save();
      }
      if (type === "crypto") {
        settings.depositLimits.crypto.min = min;
        settings.depositLimits.crypto.max = max;
        await settings.save();
      }
    } else if (method === "withdrawal") {
      if (type === "bank") {
        settings.withdrawalLimits.bank.min = min;
        settings.withdrawalLimits.bank.max = max;
        await settings.save();
      }
      if (type === "crypto") {
        settings.withdrawalLimits.crypto.min = min;
        settings.withdrawalLimits.crypto.max = max;
        await settings.save();
      }
    } else {
      throw new CustomError("Unknown operation!", 400);
    }
    return settings;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

module.exports = { createSettings, editBank, editLimit, editWallets };
