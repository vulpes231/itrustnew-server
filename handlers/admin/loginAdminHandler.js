const { loginAdmin } = require("../../services/admin/adminService");

const adminSignin = async (req, res, next) => {
	try {
		console.log(req.body);
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

module.exports = { adminSignin };
