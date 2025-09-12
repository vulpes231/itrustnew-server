const Admin = require("../../models/Admin");
const { CustomError } = require("../../utils/utils");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

async function registerAdmin(adminData) {
	const { email, username, password, adminRole } = adminData;
	if (!email || !adminRole) throw new CustomError("Bad request!", 400);

	try {
		const emailExists = await Admin.findOne({ email });
		if (emailExists) throw new CustomError("Email taken!", 409);

		const userExists = await Admin.findOne({ username });
		if (userExists) throw new CustomError("Username taken!", 409);

		const hashedPassword = await bcrypt.hash(password, 10);

		const customRole =
			adminRole === "admin"
				? process.env.ADMIN_CODE
				: process.env.SUPER_USER_CODE;

		const newAdminData = {
			username,
			password: hashedPassword,
			email,
			role: customRole,
		};

		const admin = await Admin.create(newAdminData);
		return admin.username;
	} catch (error) {
		throw new CustomError("Failed to register admin", 500);
	}
}

async function loginAdmin(adminData) {
	const { email, password } = adminData;
	try {
		const admin = await Admin.findOne({ email });
		if (!admin) throw new CustomError("Admin does not exist!", 400);

		const passMatch = await bcrypt.compare(password, admin.password);
		if (!passMatch) throw new CustomError("Invalid username or password!", 400);

		if (
			admin.role !== process.env.ADMIN_CODE ||
			admin.role !== process.env.SUPER_USER_CODE
		)
			throw new CustomError("You are not authorized on this server!", 400);

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
		throw new CustomError(error.message, 500);
	}
}

module.exports = { loginAdmin, registerAdmin };
