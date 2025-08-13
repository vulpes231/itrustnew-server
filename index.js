const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectDB, corsOptions } = require("./configs/settings.js");
const { errorLogger, reqLogger } = require("./middlewares/loggers.js");
const { mongoose } = require("mongoose");
require("dotenv").config();
const {
	initWalletGrowthCronJobs,
	shutdownCronJobs,
	devRouter,
} = require("./jobs/jobs");

// Initialize cron jobs
initWalletGrowthCronJobs();

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

if (process.env.NODE_ENV === "development") {
	app.use("/test-crons", devRouter);
}

// Middleware
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(reqLogger);

// routers
const rootRouter = require("./routes/root");

// routes
app.use("/", rootRouter);

let server;
mongoose.connection.once("connected", () => {
	server = app.listen(PORT, () =>
		console.log(`Server started on http://localhost:${PORT}`)
	);
});

app.use(errorLogger);

const shutdown = async (signal) => {
	console.log(`\nReceived ${signal}, shutting down gracefully...`);

	// Track if we've already started shutting down
	if (global.isShuttingDown) return;
	global.isShuttingDown = true;

	const shutdownTimeout = setTimeout(() => {
		console.error("Shutdown timeout forced");
		process.exit(1);
	}, 15000); // 15 second timeout

	try {
		// 1. Stop accepting new connections
		if (server) {
			console.log("Closing HTTP server...");
			await new Promise((resolve) => {
				server.close((err) => {
					if (err) console.error("HTTP server close error:", err);
					resolve();
				});
				// Force close connections after 8 seconds
				setTimeout(() => server.closeAllConnections(), 8000);
			});
			console.log("✅ HTTP server closed");
		}

		// 2. Stop cron jobs
		console.log("Stopping cron jobs...");
		await shutdownCronJobs();
		console.log("✅ Cron jobs stopped");

		// 3. Close MongoDB connection
		if (mongoose.connection.readyState === 1) {
			console.log("Closing MongoDB connection...");
			await mongoose.disconnect();
			console.log("✅ MongoDB connection closed");
		}

		// 4. Close other resources (redis, etc.) if any
		// await redisClient.quit();

		console.log("🛑 Shutdown complete");
		clearTimeout(shutdownTimeout);
		process.exit(0);
	} catch (err) {
		console.error("❌ Shutdown error:", err);
		clearTimeout(shutdownTimeout);
		process.exit(1);
	}
};

// Handle signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
