const {
	fetchAdmins,
	assignRole,
	removeRole,
} = require("../../services/admin/adminService");

const getAdmins = async (req, res, next) => {
	try {
		const admins = await fetchAdmins();
		res.status(200).json({
			message: `Admins retrieved successfully.`,
			success: true,
			data: admins,
		});
	} catch (error) {
		next(error);
	}
};

const elevateAdmin = async (req, res, next) => {
	const { adminId, role } = req.body;
	try {
		await assignRole(adminId, role);
		res.status(200).json({
			message: `New role assigned successfully.`,
			success: true,
			data: null,
		});
	} catch (error) {
		next(error);
	}
};

const deElevateAdmin = async (req, res, next) => {
	const { adminId, role } = req.body;
	try {
		await removeRole(adminId, role);
		res.status(200).json({
			message: `Role removed successfully.`,
			success: true,
			data: null,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { elevateAdmin, deElevateAdmin, getAdmins };
