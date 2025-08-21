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
const { verifyJWT } = require("./middlewares/verifyJWT.js");

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

// general routes
const rootRoute = require("./routes/root");
const locationRoute = require("./routes/location.js");
const currencyRoute = require("./routes/currency.js");
const assetRoute = require("./routes/asset.js");
const userRegisterRoute = require("./routes/user/register.js");
const userLoginRoute = require("./routes/user/login.js");

//protected routes
const otpVerificationRoute = require("./routes/user/verification.js");
const mailRoute = require("./routes/mail.js");
const userProfileRoute = require("./routes/user/user.js");
const walletRoute = require("./routes/user/wallet.js");
const transactionRoute = require("./routes/user/transaction.js");
const watchlistRoute = require("./routes/user/watchlist.js");
const investPlanRoute = require("./routes/user/autoplan.js");
const tradeRoute = require("./routes/user/trade.js");
const savingsRoute = require("./routes/user/savings.js");

// routes
app.use("/", rootRoute);
app.use("/location", locationRoute);
app.use("/currency", currencyRoute);
app.use("/register", userRegisterRoute);
app.use("/login", userLoginRoute);
app.use("/code", otpVerificationRoute);
app.use("/mail", mailRoute);
app.use("/asset", assetRoute);
app.use("/plan", investPlanRoute);

app.use(verifyJWT);
app.use("/user", userProfileRoute);
app.use("/wallet", walletRoute);
app.use("/transaction", transactionRoute);
app.use("/watchlist", watchlistRoute);
app.use("/trade", tradeRoute);
app.use("/savings", savingsRoute);

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
