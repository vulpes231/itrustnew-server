const {
	fetchAdmins,
	fetchAdminInfo,
	deleteAdmin,
	updateAdminRole,
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

const updateRole = async (req, res, next) => {
	const { adminId, action } = req.body;
	try {
		await updateAdminRole(adminId, action);
		res.status(200).json({
			message:
				action == "addsu"
					? `New role assigned successfully.`
					: `New removed assigned successfully.`,
			success: true,
			data: null,
		});
	} catch (error) {
		next(error);
	}
};

const removeAdmin = async (req, res, next) => {
	const { adminId } = req.body;

	console.log(req.body);
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
	updateRole,
	getAdmins,
	getAdminInfo,
	removeAdmin,
};
