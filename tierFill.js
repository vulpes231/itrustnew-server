require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const { setServers } = require("node:dns/promises");
const UserTierService = require("./services/user/tierService");

setServers(["1.1.1.1", "8.8.8.8"]);
const MONGO_URI = process.env.DATABASE_URI;

async function backfillUserTiers() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined");
  }

  await mongoose.connect(MONGO_URI);

  console.log("Connected to MongoDB");
  console.log("Starting user tier backfill...\n");

  let processed = 0;
  let upgraded = 0;
  let unchanged = 0;
  let failed = 0;

  const cursor = User.find({}).select("_id accountTier").cursor();

  for await (const user of cursor) {
    processed++;

    try {
      const previousTier = Number(user.accountTier?.currentTier) || 0;

      const result = await UserTierService.updateTierProgress(user._id);

      const newTier = Number(result.currentTier) || 0;

      if (newTier > previousTier) {
        upgraded++;

        console.log(
          `[UPGRADED] ${user._id} | ` +
            `Tier ${previousTier} -> Tier ${newTier} | ` +
            `Balance: ${result.totalBalance}`,
        );
      } else {
        unchanged++;

        console.log(
          `[UNCHANGED] ${user._id} | ` +
            `Tier ${previousTier} | ` +
            `Eligible: ${result.eligibleTier} | ` +
            `Balance: ${result.totalBalance}`,
        );
      }
    } catch (error) {
      failed++;

      console.error(`[FAILED] ${user._id}`, error.message);
    }
  }

  console.log("\n-----------------------------------");
  console.log("Tier backfill completed");
  console.log("-----------------------------------");
  console.log(`Users processed : ${processed}`);
  console.log(`Users upgraded  : ${upgraded}`);
  console.log(`Users unchanged : ${unchanged}`);
  console.log(`Users failed    : ${failed}`);
  console.log("-----------------------------------\n");

  await mongoose.disconnect();

  console.log("MongoDB connection closed");
}

backfillUserTiers()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("\nBackfill failed:");
    console.error(error);

    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors.
    }

    process.exit(1);
  });
