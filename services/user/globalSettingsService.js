const WalletSetting = require("../../models/Walletsetting");
const { CustomError } = require("../../utils/utils");

async function getSettings() {
  try {
    const settings = await WalletSetting.findOne({ name: "global" }).lean();
    return settings;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

module.exports = { getSettings };
