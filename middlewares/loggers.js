const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { format } = require("date-fns");
const { v4: uuid } = require("uuid");
const { getClientIp } = require("../utils/utils");

const logEvent = async (message, fileName) => {
	const currentDate = format(new Date(), "EEE-MMM-yyyy\thh:mm a");
	const logMsg = `${currentDate}\t${uuid()}\t${message}`;

	console.log(logMsg);
	const logPath = path.join(__dirname, "../logs");
	const logFilePath = path.join(logPath, fileName);
	try {
		if (!fs.existsSync(logPath)) {
			await fsPromises.mkdir(logPath);
		}
		await fsPromises.appendFile(logFilePath, logMsg);
	} catch (error) {
		console.log("object", error.message);
	}
};

function reqLogger(req, res, next) {
	const clientIp = getClientIp(req);
	logEvent(`${req.method}\t\t${req.url}\t\tip:${clientIp}\n`, "reqs.txt");
	next();
}
function errorLogger(err, req, res, next) {
	logEvent(`${err.message}\t${err.stack}\n`, "err.txt");
	next();
}

module.exports = { logEvent, reqLogger, errorLogger };
