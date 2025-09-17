// middlewares/requireRole.js
const jwt = require("jsonwebtoken");
const { CustomError } = require("../utils/utils");
require("dotenv").config();

function requireRole(requiredRoles = []) {
	return (req, res, next) => {
		const authHeader = req.headers.authorization || req.headers.Authorization;

		if (!authHeader?.startsWith("Bearer ")) {
			return res.status(401).json({ message: "Unauthorized!" });
		}

		const token = authHeader.split(" ")[1];
		if (!token) {
			return res.status(401).json({ message: "You're not logged in!" });
		}

		try {
			const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

			// ensure decoded.role is always an array
			const roles = Array.isArray(decoded.role) ? decoded.role : [decoded.role];

			// check intersection
			const hasRole = roles.some((r) => requiredRoles.includes(r));

			if (!hasRole) {
				throw new CustomError("Forbidden!", 403);
			}

			req.user = decoded; // keep user payload for handlers
			next();
		} catch (err) {
			return res.status(403).json({ message: "Forbidden", error: err.message });
		}
	};
}

module.exports = { requireRole };
