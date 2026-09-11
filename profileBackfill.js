import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import { setServers } from "node:dns/promises";

setServers(["1.1.1.1", "8.8.8.8"]);

dotenv.config();

const MONGO_URI = process.env.DATABASE_URI;

function isFilled(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isProfileComplete(user) {
  const contactInfo = user.contactInfo || {};

  return (
    isFilled(contactInfo.email) &&
    isFilled(contactInfo.street) &&
    isFilled(contactInfo.country?.countryId) &&
    isFilled(contactInfo.state?.stateId) &&
    isFilled(contactInfo.zipCode)
  );
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("Connected to MongoDB");

    const users = await User.find(
      {},
      {
        _id: 1,
        email: 1,
        contactInfo: 1,
        accountStatus: 1,
      },
    ).lean();

    console.log(`Found ${users.length} users`);

    const summary = {
      complete: 0,
      incomplete: 0,
    };

    const bulkOperations = [];

    for (const user of users) {
      const profileComplete = isProfileComplete(user);

      if (profileComplete) {
        summary.complete++;
      } else {
        summary.incomplete++;
      }

      bulkOperations.push({
        updateOne: {
          filter: {
            _id: user._id,
          },
          update: {
            $set: {
              "accountStatus.isProfileComplete": profileComplete,
            },
          },
        },
      });
    }

    if (bulkOperations.length > 0) {
      const result = await User.bulkWrite(bulkOperations);

      console.log(`\nUpdated ${result.modifiedCount} users`);
    }

    console.log("\nProfile completion summary");
    console.log("--------------------------");
    console.log(`Complete:     ${summary.complete}`);
    console.log(`Incomplete:   ${summary.incomplete}`);
    console.log(`Total:        ${users.length}`);
  } catch (error) {
    console.error("\nBackfill failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
