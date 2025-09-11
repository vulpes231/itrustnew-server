const jwt = require("jsonwebtoken");
const { CustomError } = require("../utils/utils");
require("dotenv").config();

async function verifySuperUser(req, res, next) {
	const authHeader = req.headers.authorization || req.headers.Authorization;

	if (!authHeader?.startsWith("Bearer ")) {
		return res.status(401).json({ message: "Unauthorized" });
	}
	const token = authHeader.split(" ")[1];

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

	const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

	if (decoded.role !== process.env.ADMIN_CODE) {
		throw new CustomError("Forbidden!", 403);
	}

	next();
}

module.exports = { verifySuperUser, verifyAdmin };
