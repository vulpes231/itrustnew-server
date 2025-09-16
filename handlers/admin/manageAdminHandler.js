const {
	fetchAdmins,
	assignRole,
	removeRole,
	fetchAdminInfo,
	deleteAdmin,
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

const getAdminInfo = async (req, res, next) => {
	const adminId = req.user.adminId;
	try {
		const admin = await fetchAdminInfo(adminId);
		res.status(200).json({
			message: `Admin info retrieved successfully.`,
			success: true,
			data: admin,
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

const removeAdmin = async (req, res, next) => {
	const { adminId } = req.body;
	try {
		await deleteAdmin(adminId);
		res.status(200).json({
			message: `Admin removed successfully.`,
			success: true,
			data: null,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = {
	elevateAdmin,
	deElevateAdmin,
	getAdmins,
	getAdminInfo,
	removeAdmin,
};
