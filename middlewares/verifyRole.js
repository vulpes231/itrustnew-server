const jwt = require("jsonwebtoken");
const { CustomError } = require("../utils/utils");
require("dotenv").config();

async function verifySuperUser(req, res, next) {
	const authHeader = req.headers.authorization || req.headers.Authorization;

	if (!authHeader?.startsWith("Bearer ")) {
		return res.status(401).json({ message: "Unauthorized!" });
	}
	const token = authHeader.split(" ")[1];

	if (!token) return res.status(401).json({ message: "You're not logged in!" });
	const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

	if (decoded.role !== process.env.SUPER_USER_CODE) {
		throw new CustomError("Forbidden!", 403);
	}

	next();
}

async function verifyAdmin(req, res, next) {
	const authHeader = req.headers.authorization || req.headers.Authorization;

	if (!authHeader?.startsWith("Bearer ")) {
		return res.status(401).json({ message: "Unauthorized" });
	}
	const token = authHeader.split(" ")[1];

	try {
		const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

		if (
			decoded.role !== process.env.ADMIN_CODE &&
			decoded.role !== process.env.SUPER_USER_CODE
		) {
			throw new CustomError("Forbidden!", 403);
		}

		next();
	} catch (err) {
		return res.status(403).json({ message: "Forbidden", error: err.message });
	}
}

module.exports = { verifySuperUser, verifyAdmin };
