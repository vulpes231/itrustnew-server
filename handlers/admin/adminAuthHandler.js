const {
	loginAdmin,
	registerAdmin,
} = require("../../services/admin/adminService");

const adminSignin = async (req, res, next) => {
	try {
		const adminData = req.body;
		const { accessToken, refreshToken } = await loginAdmin(adminData);

		res.cookie("jwt", refreshToken, {
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000,
		});

		res.status(200).json({
			token: accessToken,
			success: true,
			data: null,
			message: "Login successful",
		});
	} catch (error) {
		next(error);
	}
};

const enrollAdmin = async (req, res, next) => {
	const role = req.user.role;

	try {
		const adminData = req.body;
		const admin = await registerAdmin(role, adminData);

		res.status(200).json({
			token: accessToken,
			success: true,
			data: null,
			message: `${admin} created successfully.`,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { enrollAdmin, adminSignin };
