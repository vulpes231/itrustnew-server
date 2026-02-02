const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectDB, corsOptions } = require("./configs/settings.js");
const { errorLogger, reqLogger } = require("./middlewares/loggers.js");
const { mongoose } = require("mongoose");
const path = require("path");
require("dotenv").config();
const { shutdownCronJobs, devRouter, initCronJobs } = require("./jobs/jobs");
const { verifyJWT } = require("./middlewares/verifyJWT.js");
const errorHandler = require("./middlewares/errorHandler.js");
const { ROLES } = require("./utils/utils.js");
const { requireRole } = require("./middlewares/requireRole.js");
const workerService = require("./services/workerService.js");
const queueService = require("./services/queueService.js");

async function initializeServices() {
  try {
    await queueService.connect();
    console.log("Queue service connected");

    await workerService.startEmailWorker();
    console.log("Email worker started");
  } catch (error) {
    console.error("Failed to initialize services:", error);
    throw error;
  }
}

initCronJobs();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors(corsOptions));

connectDB();

if (process.env.NODE_ENV === "development") {
  app.use("/test-crons", devRouter);
}

// Middleware

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/storage", express.static(path.join(__dirname, "./storage")));

app.use(cookieParser());
app.use(reqLogger);

// general routes
const rootRoute = require("./routes/root");
const locationRoute = require("./routes/location.js");
const currencyRoute = require("./routes/currency.js");
const assetRoute = require("./routes/asset.js");
const userRegisterRoute = require("./routes/user/register.js");
const userLoginRoute = require("./routes/user/login.js");
const userLogoutRoute = require("./routes/user/logout.js");

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
const kycRoute = require("./routes/user/kyc.js");
const settingsRoute = require("./routes/user/settings.js");

// admin routers
const enrollAdminRoute = require("./routes/admin/enrolladmin.js");
const loginAdminRoute = require("./routes/admin/loginadmin.js");
const manageUserRoute = require("./routes/admin/manageuser.js");
const manageAdminRoute = require("./routes/admin/manageadmin.js");
const manageTransactionRoute = require("./routes/admin/managetransaction.js");
const manageWalletRoute = require("./routes/admin/managewallet.js");
const manageTradeRoute = require("./routes/admin/managetrade.js");
const managePlansRoute = require("./routes/admin/manageplans.js");
const manageSettingsRoute = require("./routes/admin/managesettings.js");
const manageVerifyRoute = require("./routes/admin/manageverify.js");
const manageSavingsAccountRoute = require("./routes/admin/managesavingsaccount.js");

// routes

app.use("/location", locationRoute);
app.use("/currency", currencyRoute);
app.use("/signup", userRegisterRoute);
app.use("/signin", userLoginRoute);
app.use("/code", otpVerificationRoute);
app.use("/mail", mailRoute);
app.use("/asset", assetRoute);
app.use("/", rootRoute);

// admin unproteted routes
app.use("/login", loginAdminRoute);

// user protected routes
app.use(verifyJWT);
app.use("/user", userProfileRoute);
app.use("/signout", userLogoutRoute);
app.use("/wallet", walletRoute);
app.use("/transaction", transactionRoute);
app.use("/watchlist", watchlistRoute);
app.use("/trade", tradeRoute);
app.use("/savings", savingsRoute);
app.use("/kyc", kycRoute);
app.use("/settings", settingsRoute);
app.use("/invest", investPlanRoute);

//admin protected routes
app.use("/register", enrollAdminRoute);
app.use("/manageadmin", manageAdminRoute);
app.use(
  "/manageuser",
  requireRole([ROLES.ADMIN, ROLES.SUPER_USER]),
  manageUserRoute
);
app.use(
  "/managetrans",
  requireRole([ROLES.ADMIN, ROLES.SUPER_USER]),
  manageTransactionRoute
);
app.use(
  "/managewallet",
  requireRole([ROLES.ADMIN, ROLES.SUPER_USER]),
  manageWalletRoute
);
app.use(
  "/managetrade",
  requireRole([ROLES.ADMIN, ROLES.SUPER_USER]),
  manageTradeRoute
);
app.use(
  "/managesavings",
  requireRole([ROLES.ADMIN, ROLES.SUPER_USER]),
  manageSavingsAccountRoute
);
app.use(
  "/manageplans",
  requireRole([ROLES.ADMIN, ROLES.SUPER_USER]),
  managePlansRoute
);
app.use(
  "/managesettings",
  requireRole([ROLES.ADMIN, ROLES.SUPER_USER]),
  manageSettingsRoute
);
app.use(
  "/manageverify",
  requireRole([ROLES.ADMIN, ROLES.SUPER_USER]),
  manageVerifyRoute
);

let server;

mongoose.connection.once("connected", async () => {
  await initializeServices();
  server = app.listen(PORT, () =>
    console.log(`Server started on http://localhost:${PORT}`)
  );
});

app.use(errorHandler);
app.use(errorLogger);

const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  if (global.isShuttingDown) return;
  global.isShuttingDown = true;

  const shutdownTimeout = setTimeout(() => {
    console.error("Shutdown timeout forced");
    process.exit(1);
  }, 15000);

  try {
    if (server) {
      console.log("Closing HTTP server...");
      await new Promise((resolve) => {
        server.close((err) => {
          if (err) console.error("HTTP server close error:", err);
          resolve();
        });

        setTimeout(() => server.closeAllConnections(), 8000);
      });
      console.log("HTTP server closed");
    }

    await shutdownCronJobs();

    await queueService.close();

    if (mongoose.connection.readyState === 1) {
      console.log("Closing MongoDB connection...");
      await mongoose.disconnect();
      console.log("✅ MongoDB connection closed");
    }

    console.log("🛑 Shutdown complete");
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (err) {
    console.error("Shutdown error:", err);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
