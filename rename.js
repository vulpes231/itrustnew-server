const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.DATABASE_URI;

async function migrateWalletSettings() {
	const client = new MongoClient(uri);

	try {
		await client.connect();
		console.log("Connected to MongoDB");

		const db = client.db("itrust_migrated");
		const oldCollection = db.collection("settings"); // Replace with actual collection name
		const newCollection = db.collection("walletsettings"); // New collection name

		// Get sample documents (2 as requested)
		const docs = await oldCollection.find().toArray();
		console.log(`Migrating ${docs.length} documents`);

		for (const doc of docs) {
			const transformedDoc = {
				cryptoWallets: {
					btc: doc.btc_wallet,
					eth: doc.eth_wallet,
					trc: doc.trc_wallet,
					erc: doc.erc_wallet,
					note: doc.wallet_note,
				},
				bankDetails: {
					name: doc.bank_name,
					accountName: doc.bank_account_name,
					accountNumber: doc.bank_account_number,
					routingNumber: doc.bank_routing_number,
					reference: doc.bank_reference,
					address: doc.bank_address,
				},
				depositLimits: {
					bank: {
						min: doc.min_cash_bank_deposit,
						max: doc.max_cash_bank_deposit,
					},
					crypto: {
						min: doc.min_cash_crypto_deposit,
						max: doc.max_cash_crypto_deposit,
					},
				},
				withdrawalLimits: {
					bank: {
						min: doc.min_cash_bank_withdrawal,
						max: doc.max_cash_bank_withdrawal,
					},
					crypto: {
						min: doc.min_cash_crypto_withdrawal,
						max: doc.max_cash_crypto_withdrawal,
					},
				},
			};

			await newCollection.insertOne(transformedDoc);
			console.log(`Migrated document ${doc._id}`);
		}

		console.log("Migration completed successfully");
	} catch (error) {
		console.error("Migration error:", error);
	} finally {
		await client.close();
	}
}

migrateWalletSettings();
