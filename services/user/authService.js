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
  const {
    firstname,
    lastname,
    username,
    email,
    password,
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

  if (!firstname || !lastname) {
    throw new CustomError("Fullname required!", 400);
  }
  if (!username || !password) {
    throw new CustomError("Username and password required!", 400);
  }
  if (
    !email ||
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
  session.startTransaction();

  try {
    const [existingUser, existingEmail] = await Promise.all([
      User.findOne({ username }).session(session),
      User.findOne({ email }).session(session),
    ]);

    if (existingUser) {
      throw new CustomError("Username already exists!", 409);
    }
    if (existingEmail) {
      throw new CustomError("Email already in use!", 409);
    }

    const [countryInfo, stateInfo, nationInfo, currencyInfo] =
      await Promise.all([
        getCountryById(countryId),
        getStateById(stateId),
        getNationById(nationalityId),
        getCurrencyById(currencyId),
      ]);

    const hashPassword = await bcrypt.hash(password, 10);

    const [day, month, year] = dob.split("/");
    const formattedDob = new Date(`${year}-${month}-${day}`);

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
      contactInfo: {
        phone: phone,
        address: {
          street: street,
          city: city,
          zipCode: zipCode,
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
          fees: currencyInfo.fees,
        },
      },
      personalDetails: {
        dob: formattedDob,
        ssn: ssn || null,
      },
      professionalInfo: {
        experience: experience,
        employment: employment,
      },
    };

    const newUser = await User.create([userInfo], { session });
    const userId = newUser[0]._id;

    const wallets = await Promise.all([
      Wallet.create([{ name: "cash", userId, totalBalance: 0 }], { session }),
      Wallet.create(
        [{ name: "automated investing", userId, totalBalance: 0 }],
        { session }
      ),
      Wallet.create([{ name: "brokerage", userId, totalBalance: 0 }], {
        session,
      }),
    ]);

    await Usersetting.create([{ userId }], { session });

    try {
      await portFolioTracker.initializeUser(userId);
    } catch (trackerError) {
      console.warn(
        `Portfolio tracker initialization failed for user ${userId}:`,
        trackerError.message
      );
      // Continue with registration - this is non-critical
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

    const userData = {
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
      },
    };

    await session.commitTransaction();

    console.log(`User registered successfully: ${username} (${userId})`);

    return {
      userInfo: userData,
      accessToken,
      refreshToken,
    };
  } catch (error) {
    await session.abortTransaction();

    throw new CustomError(
      error.message || "Registration failed",
      error.statusCode || 500
    );
  } finally {
    session.endSession();
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

module.exports = { registerService, loginService, logoutService };
