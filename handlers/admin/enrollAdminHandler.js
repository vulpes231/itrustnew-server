const {
	registerAdmin,
	registerSuperUser,
} = require("../../services/admin/adminService");

const enrollAdmin = async (req, res, next) => {
	try {
		const adminData = req.body;
		const admin = await registerAdmin(adminData);

		res.status(200).json({
			success: true,
			data: null,
			message: `${admin} created successfully.`,
		});
	} catch (error) {
		next(error);
	}
};

const enrollSU = async (req, res, next) => {
	try {
		const adminData = req.body;
		const admin = await registerSuperUser(adminData);

		res.status(200).json({
			success: true,
			data: null,
			message: `${admin} created successfully.`,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { enrollAdmin, enrollSU };
