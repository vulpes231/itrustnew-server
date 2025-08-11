const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.DATABASE_URI;

async function migrateUserSchema() {
	const client = new MongoClient(uri);

	try {
		await client.connect();
		console.log("Connected to MongoDB");

		const db = client.db("itrust_migrated");
		const usersCollection = db.collection("users");

		// Get all users
		const users = await usersCollection.find({}).toArray();

		console.log(`Found ${users.length} users to migrate`);

		// Process each user
		for (const user of users) {
			const updateDoc = {
				$set: {
					firstName: user.first_name,
					lastName: user.last_name,
					zipCode: user.zipcode,
					employment: user.employed,
					accountStatus: user.status,
					kycStatus: user.kyc,
					idNumber: user.id_number,
					idType: user.id_type,
					idFront: user.front_id,
					idBack: user.back_id,
					emailVerified: !!user.email_verified_at,
					banned: !!user.blocked_at,
					twoFaActivated: !!user.two_fa_activated_at,
					countryId: user.country_id, // Keep as reference
					stateId: user.state_id, // Keep as reference
					currencyId: user.currency_id, // Keep as reference
					// Other fields
					username: user.username,
					password: user.password,
					email: user.email,
					phone: user.phone,
					address: user.address,
					avatar: user.avatar || null,
					city: user.city || null,
					ssn: user.ssn || null,
					dob: user.dob,
					nationality: user.nationality,
					experience: user.experience,
				},
				$unset: {
					first_name: "",
					last_name: "",
					zipcode: "",
					employed: "",
					status: "",
					kyc: "",
					id_number: "",
					id_type: "",
					front_id: "",
					back_id: "",
					email_verified_at: "",
					blocked_at: "",
					two_fa_activated_at: "",
					country_id: "",
					state_id: "",
					currency_id: "",
				},
			};

			await usersCollection.updateOne({ _id: user._id }, updateDoc);

			console.log(`Migrated user ${user.username}`);
		}

		console.log("Migration completed successfully");
	} catch (error) {
		console.error("Migration error:", error);
	} finally {
		await client.close();
	}
}

migrateUserSchema();
