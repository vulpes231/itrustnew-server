const { mongoose } = require("mongoose");
require("dotenv").config();

const allowedOrigins = [
	"http://localhost:3000",
	"https://yourproductiondomain.com",
	"https://yourotherdomain.com",
];
const DATABASE_URI = process.env.DATABASE_URI;

async function connectDB() {
	try {
		await mongoose.connect(DATABASE_URI);
		console.log("Database connection established.");
	} catch (error) {
		console.error("❌ Database connection failed:", error.message);
		process.exit(1);
	}
}

const corsOptions = {
	origin: (origin, callback) => {
		if (allowedOrigins.includes(origin) || !origin) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS"));
		}
	},
	credentials: true,
	optionsSuccessStatus: 200,
};

module.exports = { connectDB, corsOptions };
