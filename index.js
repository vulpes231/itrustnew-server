const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectDB, corsOptions } = require("./configs/settings.js");
const { errorLogger, reqLogger } = require("./middlewares/loggers.js");
const { mongoose } = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

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

	try {
		// Close HTTP server
		if (server) {
			await new Promise((resolve) => server.close(resolve));
			console.log("HTTP server closed");
		}

		// Close MongoDB connection
		if (mongoose.connection.readyState === 1) {
			await mongoose.disconnect();
			console.log("MongoDB connection closed");
		}

		console.log("Shutdown complete");
		process.exit(0);
	} catch (err) {
		console.error("Error during shutdown:", err);
		process.exit(1);
	}
};

// Handle signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
