const getClientIp = (req) => {
	// Destructure from headers first (for proxy servers)
	const ip =
		req.headers["x-forwarded-for"] ||
		req.socket.remoteAddress ||
		req.connection.remoteAddress;

	// Handle IPv6 format (::ffff:192.168.1.1 → 192.168.1.1)
	return ip.includes("::") ? ip.split(":").pop() : ip;
};

function generateOtp(length = 6) {
	const numbers = "0123456789"; // Include 0 as well
	let otp = "";

	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(Math.random() * numbers.length);
		otp += numbers[randomIndex];
	}

	return otp;
}

class CustomError extends Error {
	constructor(message, code = 500) {
		super(message);
		this.name = this.constructor.name;
		this.statusCode = code;

		Error.captureStackTrace(this, this.constructor);
	}
}

module.exports = { getClientIp, generateOtp, throwError, CustomError };
