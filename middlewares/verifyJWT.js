const jwt = require("jsonwebtoken");
require("dotenv").config();

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const verifyJWT = (req, res, next) => {
	const authHeader = req.headers.authorization || req.headers.Authorization;

	if (!authHeader?.startsWith("Bearer ")) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	const token = authHeader.split(" ")[1];

	jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			if (err.name === "TokenExpiredError") {
				return res.status(403).json({ message: "Token expired" });
			}
			return res.status(403).json({ message: "Forbidden: Invalid token" });
		}

		req.user = {
			username: decoded.username,
			userId: decoded.userId,
			role: decoded.role,
			adminId: decoded.adminId,
		};

		// console.log("JWT", decoded);

		next();
	});
};

module.exports = { verifyJWT };
