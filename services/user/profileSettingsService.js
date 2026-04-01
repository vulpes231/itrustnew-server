const User = require("../../models/User");
const { CustomError } = require("../../utils/utils");

class ProfileOptionService {
  async toggleField(userId, fieldPath, responseKey) {
    if (!userId) throw new CustomError("Bad request!", 400);

    try {
      const user = await User.findById(userId).select(fieldPath);
      if (!user) throw new CustomError("User not found!", 404);

      const currentValue = fieldPath
        .split(".")
        .reduce((obj, key) => obj?.[key], user);

      const newValue = !Boolean(currentValue);

      await User.findByIdAndUpdate(userId, {
        $set: { [fieldPath]: newValue },
      });

      return { [responseKey]: newValue };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw new CustomError(error.message, error.statusCode || 500);
    }
  }

  updateDripOption(userId) {
    return this.toggleField(userId, "investmentInfo.drip", "dripStatus");
  }

  updateMarginTrading(userId) {
    return this.toggleField(userId, "investmentInfo.margin", "marginStatus");
  }

  updateOptionsTrading(userId) {
    return this.toggleField(userId, "investmentInfo.options", "optionStatus");
  }

  updateEmailNotify(userId) {
    return this.toggleField(
      userId,
      "mailing.emailNotification",
      "emailNotifyStatus"
    );
  }

  updatePriceAlert(userId) {
    return this.toggleField(userId, "mailing.priceAlert", "priceAlertStatus");
  }

  updateOrderNotify(userId) {
    return this.toggleField(
      userId,
      "mailing.orderNotification",
      "orderNotifyStatus"
    );
  }

  updateLoginAlert(userId) {
    return this.toggleField(userId, "mailing.loginAlert", "loginAlertStatus");
  }
}

module.exports = new ProfileOptionService();
