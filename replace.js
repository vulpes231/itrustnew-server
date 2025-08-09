const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.DATABASE_URI;

async function migrateWalletUserReferences() {
	const client = new MongoClient(uri);

	try {
		await client.connect();
		console.log("Connected to MongoDB");

		// Connect to the specific database where your data lives
		const db = client.db("itrust_migrated");
		const settingsCollection = db.collection("user_settings");
		const usersCollection = db.collection("users");

		// Verify counts
		console.log(`Users count: ${await usersCollection.countDocuments()}`);
		console.log(`Settings count: ${await settingsCollection.countDocuments()}`);

		// Test with known user ID
		const testUserId = "9e9364bb-2b55-488c-993c-06cf555a2749";
		const testUser = await usersCollection.findOne({ id: testUserId });
		console.log(`Test user lookup: ${testUser ? "SUCCESS" : "FAILED"}`);
		if (testUser) {
			console.log(`Test user _id: ${testUser._id}`);
		}

		// Perform migration
		const settings = await settingsCollection.find().toArray();
		console.log(`\nStarting migration for ${settings.length} wallets...`);

		let processed = 0;
		let updated = 0;
		let failed = 0;

		for (const setting of settings) {
			processed++;
			try {
				console.log(`\nProcessing wallet ${setting._id}`);
				console.log(`Current user_id: ${setting.user_id}`);

				const user = await usersCollection.findOne({ id: setting.user_id });

				if (user) {
					console.log(`Found user: ${user._id} (${user.email})`);
					const result = await settingsCollection.updateOne(
						{ _id: setting._id },
						{ $set: { user_id: user._id } }
					);
					updated += result.modifiedCount;
					console.log(`Updated successfully`);
				} else {
					console.log(`No user found for wallet ${setting._id}`);
					failed++;
				}
			} catch (err) {
				console.error(`Error processing wallet ${setting._id}:`, err);
				failed++;
			}
		}

		console.log(`\nMigration complete:
        - Processed: ${processed}
        - Updated: ${updated}
        - Failed: ${failed}`);
	} catch (err) {
		console.error("Migration error:", err);
	} finally {
		await client.close();
	}
}

// Uncomment to run the migration
migrateWalletUserReferences();
