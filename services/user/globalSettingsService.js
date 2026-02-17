const WalletSetting = require("../../models/Walletsetting");
const { CustomError } = require("../../utils/utils");

async function getSettings() {
  try {
    const settings = await WalletSetting.findOne({ name: "global" }).lean();
    return settings;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

module.exports = { getSettings };
