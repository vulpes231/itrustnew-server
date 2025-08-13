const getClientIp = (req) => {
	// Destructure from headers first (for proxy servers)
	const ip =
		req.headers["x-forwarded-for"] ||
		req.socket.remoteAddress ||
		req.connection.remoteAddress;

	// Handle IPv6 format (::ffff:192.168.1.1 → 192.168.1.1)
	return ip.includes("::") ? ip.split(":").pop() : ip;
};

module.exports = { getClientIp };
