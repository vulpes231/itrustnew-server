const {
  updateAssetsData,
  updateTradePerformance,
  updateWalletPerformance,
} = require("../../jobs/customJobs");
const Admin = require("../../models/Admin");
const { CustomError, ROLES } = require("../../utils/utils");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

async function registerAdmin(adminData) {
  const { email, username, password, adminRole } = adminData;

  if (!email || !username || !password)
    throw new CustomError("Bad request!", 400);

  try {
    const emailExists = await Admin.findOne({ email }).select(
      "-password -refreshToken"
    );
    if (emailExists) throw new CustomError("Email taken!", 409);

    const userExists = await Admin.findOne({ username }).select(
      "-password -refreshToken"
    );
    if (userExists) throw new CustomError("Username taken!", 409);

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdminData = {
      username,
      password: hashedPassword,
      email,
    };

    const admin = await Admin.create(newAdminData);

    if (adminRole) {
      const roleValue =
        adminRole === "admin"
          ? ROLES[adminRole.toUpperCase()]
          : ROLES["SUPER_USER"];

      if (roleValue) {
        if (!admin.role.includes(roleValue)) {
          admin.role.push(roleValue);
          await admin.save();
        }
      }
    }

    const safeAdmin = await Admin.findById(admin._id).select(
      "-password -refreshToken"
    );

    return {
      username: safeAdmin.username,
      email: safeAdmin.email,
      role: safeAdmin.role,
    };
  } catch (error) {
    throw new CustomError(error.message, error.statusCode || 500);
  }
}

async function registerSuperUser(adminData) {
  const { email, username, password, adminRole } = adminData;

  if (!email || !adminRole || !username || !password)
    throw new CustomError("Bad request!", 400);

  try {
    const emailExists = await Admin.findOne({ email }).select(
      "-password -refreshToken"
    );
    if (emailExists) throw new CustomError("Email taken!", 409);

    const userExists = await Admin.findOne({ username }).select(
      "-password -refreshToken"
    );
    if (userExists) throw new CustomError("Username taken!", 409);

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdminData = {
      username,
      password: hashedPassword,
      email,
    };

    const admin = await Admin.create(newAdminData);

    if (!admin.role.includes(ROLES.SUPER_USER)) {
      admin.role.push(ROLES.SUPER_USER);
      await admin.save();
    }

    return admin.username;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

async function loginAdmin(adminData) {
  const { email, password } = adminData;

  if (!email || !password)
    throw new CustomError("Email and password required!", 400);
  try {
    const admin = await Admin.findOne({ email }).select("-refreshToken");
    if (!admin) throw new CustomError("Admin does not exist!", 400);

    const passMatch = await bcrypt.compare(password, admin.password);
    if (!passMatch) throw new CustomError("Invalid username or password!", 400);

    if (
      !admin.role.includes(ROLES.ADMIN) &&
      !admin.role.includes(ROLES.SUPER_USER)
    ) {
      throw new CustomError("You're not allowed on this server", 403);
    }

    const accessToken = jwt.sign(
      {
        username: admin.username,
        adminId: admin._id,
        role: admin.role,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1d" }
    );

    const refreshToken = jwt.sign(
      {
        username: admin.username,
        adminId: admin._id,
        role: admin.role,
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    admin.refreshToken = refreshToken;
    await admin.save();

    return { accessToken, refreshToken };
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

async function updateAdminRole(adminId, action) {
  if (!adminId || !action) throw new CustomError("Bad request!", 400);
  try {
    const admin = await Admin.findById(adminId);
    if (!admin) throw new CustomError("Admin not found!", 404);

    if (action === "addsu") {
      if (!admin.role.includes(ROLES.SUPER_USER)) {
        admin.role.push(ROLES.SUPER_USER);

        await admin.save();
      }
    } else if (action === "removesu") {
      if (admin.role.includes(ROLES.SUPER_USER)) {
        admin.role = admin.role.filter((r) => r !== ROLES.SUPER_USER);

        await admin.save();
      }
    } else {
      throw new CustomError("Unknown action!", 400);
    }

    return admin.role;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function fetchAdmins() {
  try {
    const admins = await Admin.find().select("-password -refreshToken");
    return admins;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function fetchAdminInfo(adminId) {
  if (!adminId) throw new CustomError("Bad request!", 400);
  try {
    const admin = await Admin.findById(adminId).select(
      "-password -refreshToken"
    );
    if (!admin) throw new CustomError("Admin not found!", 404);

    return admin;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function deleteAdmin(adminId) {
  if (!adminId) throw new CustomError("Bad request!", 400);
  try {
    const adminToDelete = await Admin.findByIdAndDelete(adminId);
    if (!adminToDelete) throw new CustomError("Admin not found!", 404);
    return true;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function logoutAdmin(adminId) {
  try {
    const admin = await Admin.findById(adminId).select("-password");
    if (!admin) {
      throw new CustomError("Admin not found!", 404);
    }
    admin.refreshToken = null;
    await admin.save();
    return admin;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function manualSystemUpdate() {
  try {
    console.log("Manual update of all cron jobs triggered");

    // Run in sequence to avoid overload
    await updateAssetsData();
    await updateTradePerformance();
    await updateWalletPerformance();

    return true;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
}

module.exports = {
  loginAdmin,
  logoutAdmin,
  registerAdmin,
  registerSuperUser,
  updateAdminRole,
  fetchAdmins,
  fetchAdminInfo,
  deleteAdmin,
  manualSystemUpdate,
};
