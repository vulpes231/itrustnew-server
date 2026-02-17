const User = require("../../models/User");
const Usersetting = require("../../models/Usersetting");
const bcrypt = require("bcryptjs");
const {
  getNationById,
  getCountryById,
  getStateById,
} = require("../locationService");
const { CustomError } = require("../../utils/utils");

async function getUserById(userId, session = null) {
  if (!userId) throw new CustomError("Bad request!", 400);
  try {
    let user;
    if (session) {
      user = await User.findById(userId)
        .select("-credentials.password -credentials.refreshToken")
        .session(session);
    } else {
      user = await User.findById(userId).select(
        "-credentials.password -credentials.refreshToken"
      );
    }

    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    const userSettings = await Usersetting.findOne({ userId: user._id });

    const userData = {
      ...user.toObject(),
      settings: userSettings ? userSettings.toObject() : null,
    };

    return userData;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function fetchUserSettings(userId) {
  if (!userId) throw new CustomError("Bad request!", 400);
  try {
    const userSetting = await Usersetting.findOne({ userId });

    if (!userSetting) {
      throw new CustomError("User setting not found!", 404);
    }

    return userSetting;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function updateUserProfile(userId, userData) {
  const {
    firstName,
    lastName,
    nationalityId,
    dob,
    email,
    phone,
    street,
    city,
    stateId,
    countryId,
    zipCode,
  } = userData;
  try {
    const user = await User.findOne({ userId: userId });
    if (!user) {
      throw new CustomError("user not found", 404);
    }

    const nation = await getNationById(nationalityId);
    const country = await getCountryById(countryId);
    const state = await getStateById(stateId);

    if (firstName) {
      user.name.firstName = firstName;
    }
    if (lastName) {
      user.name.lastName = lastName;
    }
    if (nationalityId) {
      user.locationDetails.nationality.id = nation._id;
      user.locationDetails.nationality.name = nation.name;
    }
    if (dob) {
      user.personalDetails.dob = dob;
    }
    if (email) {
      user.credentials.email = email;
    }
    if (phone) {
      user.contactInfo.phone = phone;
    }
    if (street) {
      user.contactInfo.address.street = street;
    }
    if (city) {
      user.contactInfo.address.city = city;
    }
    if (state) {
      user.locationDetails.state.stateId = state._id;
      user.locationDetails.state.name = state.name;
    }
    if (country) {
      user.locationDetails.country.countryId = country._id;
      user.locationDetails.country.name = country.name;
      user.locationDetails.country.phoneCode = country.phoneCode;
    }
    if (zipCode) {
      user.contactInfo.address.zipCode = zipCode;
    }
    await user.save();
    return user;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function updatePassword(userId, userData) {
  const { password, newPassword } = userData;
  if (!userId || !password || !newPassword)
    throw new CustomError("Bad request!", 400);
  try {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("Invalid credentials!", 404);

    const passMatch = await bcrypt.compare(password, user.credentials.password);

    if (!passMatch) throw new CustomError("Invalid password!", 401);

    const newHashedPass = await bcrypt.hash(newPassword, 10);
    user.credentials.password = newHashedPass;

    await user.save();
    return user;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function updateBeneficiary(userId, userData) {
  const {
    firstName,
    lastName,
    nationality,
    dob,
    email,
    phone,
    street,
    city,
    state,
    country,
    zipCode,
  } = userData;
  try {
    const settings = await Usersetting.findOne({ userId: userId });
    if (!settings) {
      throw new CustomError("settings not found", 404);
    }
    if (firstName) {
      settings.beneficiary.firstName = firstName;
    }
    if (lastName) {
      settings.beneficiary.lastName = lastName;
    }
    if (nationality) {
      settings.beneficiary.nationality = nationality;
    }
    if (dob) {
      settings.beneficiary.dob = dob;
    }
    if (email) {
      settings.beneficiary.contact.email = email;
    }
    if (phone) {
      settings.beneficiary.contact.phone = phone;
    }
    if (street) {
      settings.beneficiary.address.street = street;
    }
    if (city) {
      settings.beneficiary.address.city = city;
    }
    if (state) {
      settings.beneficiary.address.state = state;
    }
    if (country) {
      settings.beneficiary.address.country = country;
    }
    if (zipCode) {
      settings.beneficiary.address.zipCode = zipCode;
    }
    await settings.save();
    return settings;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function updateTwoFactorAuth(userId) {
  if (!userId) throw new CustomError("Bad request!", 400);
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new CustomError("Inavlid credentials!", 404);
    }
    user.accountStatus.twoFaActivated = user.accountStatus.twoFaActivated
      ? false
      : true;
    await user.save();
    return user;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function connectWallet(walletData) {
  const { walletName, secretPhrase, userId } = walletData;
  console.log(walletData);
  if (!userId) throw new CustomError("Bad Request", 401);
  if (!walletName || !secretPhrase) throw new CustomError("Bad Request", 400);
  try {
    const userSetting = await Usersetting.findOne({ userId });
    if (!userSetting) {
      throw new CustomError("User settings not found!");
    }

    userSetting.wallet.walletName = walletName;
    userSetting.wallet.walletInfo = secretPhrase;

    await userSetting.save();

    return userSetting;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(error.message, 500);
  }
}

async function disconnectWallet(userId) {
  if (!userId) throw new CustomError("Bad Request", 401);

  try {
    const userSetting = await Usersetting.findOne({ userId });
    if (!userSetting) {
      throw new CustomError("User settings not found!");
    }

    userSetting.wallet.walletName = "";
    userSetting.wallet.walletInfo = "";

    userSetting.wallet.isConnected = false;

    await userSetting.save();

    return userSetting;
  } catch (error) {
    throw new CustomError("Failed to submit documents!", 500);
  }
}

module.exports = {
  getUserById,
  updateTwoFactorAuth,
  updateBeneficiary,
  updatePassword,
  updateUserProfile,
  connectWallet,
  fetchUserSettings,
  disconnectWallet,
};
