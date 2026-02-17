const User = require("../../models/User");
const {
  getCountryById,
  getNationById,
  getStateById,
} = require("../locationService");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { getUserById } = require("./userService");
const { getCurrencyById } = require("../currencyService");
const Wallet = require("../../models/Wallet");
const { sendLoginCode } = require("../mailService");
const Usersetting = require("../../models/Usersetting");
const { CustomError } = require("../../utils/utils");
const { default: mongoose } = require("mongoose");
const portFolioTracker = require("../user/chartService");

async function registerService(userData) {
  const { firstname, lastname, username, email, password } = userData;

  if (!firstname || !lastname) {
    throw new CustomError("Fullname required!", 400);
  }
  if (!username || !password || !email) {
    throw new CustomError("Username, password and email required!", 400);
  }

  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    await session.startTransaction({
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxTimeMS: 10000,
    });

    const [existingUser, existingEmail] = await Promise.all([
      User.findOne({ "credentials.username": username }).session(session),
      User.findOne({ "credentials.email": email }).session(session),
    ]);

    if (existingUser) {
      throw new CustomError("Username already exists!", 409);
    }
    if (existingEmail) {
      throw new CustomError("Email already in use!", 409);
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const userInfo = {
      name: {
        firstName: firstname,
        lastName: lastname,
      },
      credentials: {
        username: username,
        password: hashPassword,
        email: email,
      },
    };

    const newUser = await User.create([userInfo], { session });
    const userId = newUser[0]._id;

    const walletData = [
      { name: "cash", userId },
      { name: "automated investing", userId },
      { name: "brokerage", userId },
      // { name: "margin", userId },
    ];

    await Wallet.insertMany(walletData, { session });
    await Usersetting.create([{ userId }], { session });

    try {
      await portFolioTracker.initializeUser(userId);
    } catch (trackerError) {
      console.warn(
        `Portfolio tracker initialization failed for user ${userId}:`,
        trackerError.message
      );
    }

    const user = await getUserById(userId, session);

    const accessToken = jwt.sign(
      {
        username: user.credentials.username,
        userId: user._id,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1d" }
    );

    const refreshToken = jwt.sign(
      {
        username: user.credentials.username,
        userId: user._id,
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "4d" }
    );

    await session.commitTransaction();
    transactionCommitted = true;

    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    if (session.inTransaction() && !transactionCommitted) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Error aborting transaction:", abortError.message);
      }
    }

    if (error.code === 11000 || error.code === 11001) {
      const field = error.keyPattern?.username
        ? "Username"
        : error.keyPattern?.email
        ? "Email"
        : "Field";
      throw new CustomError(`${field} already exists!`, 409);
    }

    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(
      error.message || "Registration failed",
      error.statusCode || 500
    );
  } finally {
    if (!session.hasEnded) {
      try {
        await session.endSession();
      } catch (sessionError) {
        console.error("Error ending session:", sessionError.message);
      }
    }
  }
}

async function completeRegister(userData, userId) {
  const {
    phone,
    street,
    city,
    zipCode,
    countryId,
    stateId,
    nationalityId,
    dob,
    ssn,
    experience,
    employment,
    currencyId,
  } = userData;

  if (
    !phone ||
    !dob ||
    !countryId ||
    !stateId ||
    !nationalityId ||
    !currencyId
  ) {
    throw new CustomError("Contact information required!", 400);
  }

  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const user = await User.findById(userId).session(session);

    if (!user) {
      await session.abortTransaction();
      await session.endSession();
      throw new CustomError("User not found!", 404);
    }

    const [countryInfo, stateInfo, nationInfo, currencyInfo] =
      await Promise.all([
        getCountryById(countryId),
        getStateById(stateId),
        getNationById(nationalityId),
        getCurrencyById(currencyId),
      ]);

    const [day, month, year] = dob.split("/");
    const formattedDob = new Date(`${year}-${month}-${day}`);

    if (isNaN(formattedDob.getTime())) {
      throw new CustomError("Invalid date format. Use DD/MM/YYYY", 400);
    }

    const updateData = {
      $set: {
        contactInfo: {
          phone: phone,
          address: {
            street: street || null,
            city: city || null,
            zipCode: zipCode || null,
          },
        },
        locationDetails: {
          country: {
            countryId: countryInfo._id,
            name: countryInfo.name,
            phoneCode: countryInfo.phoneCode,
          },
          state: {
            stateId: stateInfo._id,
            name: stateInfo.name,
          },
          nationality: {
            id: nationInfo._id,
            name: nationInfo.name,
          },
          currency: {
            id: currencyInfo._id,
            name: currencyInfo.name,
            symbol: currencyInfo.symbol,
            sign: currencyInfo.sign,
            rate: currencyInfo.rate,
          },
        },
        personalDetails: {
          dob: formattedDob,
          ssn: ssn || null,
        },
        professionalInfo: {
          experience: experience || null,
          employment: employment || null,
        },
        "accountStatus.isProfileComplete": true,
      },
    };

    await User.findByIdAndUpdate(user._id, updateData, {
      runValidators: true,
      session,
      new: true,
    });

    await session.commitTransaction();

    const updatedUser = await User.findById(userId);

    const userDataResponse = {
      credentials: {
        username: updatedUser.credentials.username,
        email: updatedUser.credentials.email,
      },
      identityVerification: {
        kycStatus: updatedUser.identityVerification.kycStatus,
      },
      accountStatus: {
        status: updatedUser.accountStatus.status,
        banned: updatedUser.accountStatus.banned,
        emailVerified: updatedUser.accountStatus.emailVerified,
        twoFaActivated: updatedUser.accountStatus.twoFaActivated,
        twoFaVerified: updatedUser.accountStatus.twoFaVerified,
        otp: updatedUser.accountStatus.otp,
        isProfileComplete: updatedUser.accountStatus.isProfileComplete,
      },
    };

    return {
      userInfo: userDataResponse,
    };
  } catch (error) {
    if (session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Error aborting transaction:", abortError.message);
      }
    }

    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(
      error.message || "Complete Account failed",
      error.statusCode || 500
    );
  } finally {
    await session.endSession();
  }
}

async function loginService(loginData) {
  const { email, password } = loginData;
  if (!email || !password) {
    throw new CustomError("Email and password required!", 400);
  }
  try {
    const user = await User.findOne({ "credentials.email": email });
    if (!user) {
      throw new CustomError("User does not exist!", 404);
    }

    const verifyPassword = await bcrypt.compare(
      password,
      user.credentials.password
    );
    if (!verifyPassword) {
      throw new CustomError("Invalid email or password!", 400);
    }

    if (user.accountStatus.twoFaActivated) {
      const email = user.credentials.email;
      const otp = await sendLoginCode(email);
      user.accountStatus.otp = otp;
      await user.save();

      const userInfo = {
        credentials: {
          username: user.credentials.username,
          email: email,
        },
        identityVerification: {
          kycStatus: user.identityVerification.kycStatus,
        },
        accountStatus: {
          status: user.accountStatus.status,
          banned: user.accountStatus.banned,
          emailVerified: user.accountStatus.emailVerified,
          twoFaActivated: user.accountStatus.twoFaActivated,
          twoFaVerified: user.accountStatus.twoFaVerified,
          otp: user.accountStatus.otp,
          isProfileComplete: user.accountStatus.isProfileComplete,
        },
      };

      return { userInfo };
    } else {
      const accessToken = jwt.sign(
        {
          username: user.credentials.username,
          userId: user._id,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      const refreshToken = jwt.sign(
        {
          username: user.credentials.username,
          userId: user._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "4d" }
      );

      user.credentials.refreshToken = refreshToken;
      await user.save();

      const userInfo = {
        credentials: {
          username: user.credentials.username,
          email: user.credentials.email,
        },
        identityVerification: {
          kycStatus: user.identityVerification.kycStatus,
        },
        accountStatus: {
          status: user.accountStatus.status,
          banned: user.accountStatus.banned,
          emailVerified: user.accountStatus.emailVerified,
          twoFaActivated: user.accountStatus.twoFaActivated,
          isProfileComplete: user.accountStatus.isProfileComplete,
        },
      };

      return { accessToken, refreshToken, userInfo };
    }
  } catch (error) {
    // console.log(error);
    throw new CustomError(error.message, error.statusCode);
  }
}

async function logoutService(userId) {
  if (!userId) {
    throw new CustomError("Bad request!", 400);
  }
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new CustomError("User not found!", 404);
    }
    user.credentials.refreshToken = null;
    if (user.accountStatus.twoFaActivated) {
      user.accountStatus.twoFaVerified = false;
    }
    await user.save();
    return true;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

module.exports = {
  registerService,
  loginService,
  logoutService,
  completeRegister,
};
