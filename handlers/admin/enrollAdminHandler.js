const { registerAdmin } = require("../../services/admin/adminService");

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

module.exports = { enrollAdmin };
