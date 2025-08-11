const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.DATABASE_URI;

async function migrateAutoPlans() {
	const client = new MongoClient(uri);

	try {
		await client.connect();
		console.log("Connected to MongoDB");

		const db = client.db("itrust_migrated");

		// Get the old collection
		const oldCollection = db.collection("auto_plans");
		// Reference the new collection
		const newCollection = db.collection("autoplans");

		const plans = await oldCollection.find({}).toArray();
		console.log(`Found ${plans.length} plans to migrate`);

		// Process each document
		const operations = plans.map((plan) => {
			return {
				insertOne: {
					document: {
						name: plan.name,
						minInvest: plan.min_invest,
						maxInvest: plan.max_invest,
						winRate: plan.win_rate,
						duration: plan.duration,
						milestone: plan.milestone,
						aum: plan.aum,
						expectedReturn: parseFloat(plan.expected_returns), // Convert string to number
						dailyReturn: parseFloat(plan.day_returns), // Convert string to number
						status: plan.status,
						img: plan.img,
						planType: plan.type,
						// Let timestamps be auto-generated for the new collection
						// The original timestamps are in created_at and updated_at if you need them
					},
				},
			};
		});

		// Bulk write to new collection
		if (operations.length > 0) {
			await newCollection.bulkWrite(operations, { ordered: false });
			console.log(`Successfully migrated ${operations.length} documents`);
		}

		// Optional: Drop old collection after verification
		await oldCollection.drop();
		console.log("Dropped old collection auto_plans");

		console.log("Migration completed successfully");
	} catch (error) {
		console.error("Migration error:", error);
	} finally {
		await client.close();
	}
}

migrateAutoPlans();
