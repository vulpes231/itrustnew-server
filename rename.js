const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.DATABASE_URI;

async function migrateSavingsAccounts() {
	const client = new MongoClient(uri);

	try {
		await client.connect();
		console.log("Connected to MongoDB");

		const db = client.db("itrust_migrated");
		const oldCollection = db.collection("savings_accounts");
		const newCollection = db.collection("savingsaccount");

		const docs = await oldCollection.find().toArray();
		console.log(`Migrating ${docs.length} savings accounts`);

		const operations = [];

		for (const doc of docs) {
			// Parse country_id array (stored as JSON string)
			const countryIds = JSON.parse(doc.country_id || "[]");

			operations.push({
				insertOne: {
					document: {
						name: doc.name,
						title: doc.title,
						note: doc.note,
						interestRate: doc.rate, // Renamed from 'rate'
						contributionLimits: {
							min: doc.min_contribution,
							max: doc.max_contribution,
						},
						withdrawalLimits: {
							min: doc.min_cashout,
							max: doc.max_cashout,
						},
						eligibleCountries: countryIds, // Array of country IDs
						status: doc.status,
						// Let Mongoose handle timestamps automatically
					},
				},
			});
		}

		if (operations.length > 0) {
			// Insert into new collection
			await newCollection.bulkWrite(operations, { ordered: false });

			// Verify counts match
			const oldCount = await oldCollection.countDocuments();
			const newCount = await newCollection.countDocuments();

			if (oldCount === newCount) {
				// Only drop old collection if migration succeeded
				await oldCollection.drop();
				console.log(
					`Successfully migrated ${newCount} documents and dropped old collection`
				);
			} else {
				console.warn(
					`Count mismatch! Old: ${oldCount} | New: ${newCount} - Old collection preserved`
				);
			}
		}

		console.log("Migration completed");
	} catch (error) {
		console.error("Migration error:", error);
	} finally {
		await client.close();
	}
}

migrateSavingsAccounts();
