const fs = require("fs");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");

// Your extracted relationships
const relationships = {
	admins: {
		country_id: {
			references: "countries",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	auto_plan_investments: {
		auto_plan_id: {
			references: "auto_plans",
			field: "id",
			relationshipType: "one-to-many",
		},
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	cities: {
		state_id: {
			references: "states",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	dividends: {
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	ledgers: {
		wallet_id: {
			references: "wallets",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	model_has_permissions: {
		permission_id: {
			references: "permissions",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	model_has_roles: {
		role_id: {
			references: "roles",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	notifications: {
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	payment_methods: {
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	payments: {
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	positions: {
		asset_id: {
			references: "assets",
			field: "id",
			relationshipType: "one-to-many",
		},
		auto_plan_investment_id: {
			references: "auto_plan_investments",
			field: "id",
			relationshipType: "one-to-many",
		},
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	profit_loss_histories: {
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	role_has_permissions: {
		__isJoinTable: true,
		table1: "permissions",
		table2: "roles",
		joinField1: "permission_id",
		joinField2: "role_id",
	},
	savings: {
		savings_account_id: {
			references: "savings_accounts",
			field: "id",
			relationshipType: "one-to-many",
		},
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	savings_ledgers: {
		savings_id: {
			references: "savings",
			field: "id",
			relationshipType: "one-to-many",
		},
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	states: {
		country_id: {
			references: "countries",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	trades: {
		asset_id: {
			references: "assets",
			field: "id",
			relationshipType: "one-to-many",
		},
		auto_plan_investment_id: {
			references: "auto_plan_investments",
			field: "id",
			relationshipType: "one-to-many",
		},
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	transactions: {
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	user_settings: {
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	wallets: {
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
	watchlists: {
		asset_id: {
			references: "assets",
			field: "id",
			relationshipType: "one-to-many",
		},
		user_id: {
			references: "users",
			field: "id",
			relationshipType: "one-to-many",
		},
	},
};

async function migrate() {
	// 1. Read SQL file
	const sqlDump = fs.readFileSync("backup-current.sql", "utf8");

	// 2. Connect to MongoDB
	const mongoClient = await MongoClient.connect(process.env.DATABASE_URI);
	const mongoDb = mongoClient.db("itrust_migrated");

	// 3. Extract tables, their schemas, and data
	const tables = {};

	// Improved regex to capture column definitions
	const tableRegex =
		/CREATE TABLE `(.+?)`\s*\(([\s\S]+?)\)\s*ENGINE=InnoDB[^;]+;/g;
	const insertRegex = /INSERT INTO `(.+?)` VALUES\s*(.+?);/g;

	// First pass: Parse table schemas to get column names
	let tableMatch;
	while ((tableMatch = tableRegex.exec(sqlDump))) {
		const tableName = tableMatch[1];
		const columns = tableMatch[2]
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.startsWith("`"))
			.map((line) => {
				const match = line.match(/^`(.+?)`/);
				return match ? match[1] : null;
			})
			.filter(Boolean);

		tables[tableName] = {
			columns: columns,
			data: [],
		};
	}

	// Second pass: Parse insert statements
	let insertMatch;
	while ((insertMatch = insertRegex.exec(sqlDump))) {
		const tableName = insertMatch[1];
		if (tables[tableName]) {
			// Handle multiple rows in a single INSERT statement
			const valuesGroups = insertMatch[2]
				.split("),(")
				.map((group) => group.replace(/^\(/, "").replace(/\)$/, ""));

			valuesGroups.forEach((valuesStr) => {
				const values = parseInsertValues(valuesStr);
				tables[tableName].data.push(values);
			});
		}
	}

	// 4. Insert data into MongoDB with proper field names
	for (const [tableName, tableInfo] of Object.entries(tables)) {
		if (tableInfo.data.length === 0) continue;

		const docs = tableInfo.data.map((rowValues) => {
			const doc = {};
			// Map each value to its corresponding column name
			tableInfo.columns.forEach((colName, index) => {
				if (index < rowValues.length) {
					doc[colName] = convertValue(rowValues[index]);
				}
			});
			return doc;
		});

		// Insert in batches to avoid hitting document size limits
		const batchSize = 100;
		for (let i = 0; i < docs.length; i += batchSize) {
			const batch = docs.slice(i, i + batchSize);
			await mongoDb.collection(tableName).insertMany(batch);
		}
	}

	await mongoClient.close();
	console.log("Migration complete!");
}

// Helper function to parse SQL values
function parseInsertValues(valuesStr) {
	// Split values while handling quoted strings with commas
	const values = [];
	let current = "";
	let inQuotes = false;
	let escapeNext = false;

	for (let i = 0; i < valuesStr.length; i++) {
		const char = valuesStr[i];

		if (escapeNext) {
			current += char;
			escapeNext = false;
			continue;
		}

		if (char === "\\") {
			escapeNext = true;
			continue;
		}

		if (char === "'") {
			inQuotes = !inQuotes;
			current += char;
			continue;
		}

		if (char === "," && !inQuotes) {
			values.push(current.trim());
			current = "";
			continue;
		}

		current += char;
	}

	if (current) {
		values.push(current.trim());
	}

	return values.map((v) => {
		if (v === "NULL") return null;
		if (v === "true") return true;
		if (v === "false") return false;
		if (/^['"].*['"]$/.test(v)) return v.slice(1, -1);
		if (/^\d+$/.test(v)) return parseInt(v, 10);
		if (/^\d+\.\d+$/.test(v)) return parseFloat(v);
		if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) return new Date(v);
		return v;
	});
}

// Helper function to convert SQL values to appropriate MongoDB types
function convertValue(value) {
	if (value === null || value === undefined) return null;
	if (value === "NULL") return null;

	// Handle dates
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
		return new Date(value);
	}

	return value;
}

migrate().catch(console.error);

async function handleRegularRelations(db, tableName, relations) {
	const cursor = db.collection(tableName).find();

	while (await cursor.hasNext()) {
		const doc = await cursor.next();
		let needsUpdate = false;
		const updates = {};

		for (const [field, relation] of Object.entries(relations)) {
			if (relation.relationshipType === "one-to-many" && doc[field]) {
				// Convert to ObjectId if needed
				if (
					typeof doc[field] === "string" &&
					/^[0-9a-fA-F]{24}$/.test(doc[field])
				) {
					updates[field] = new ObjectId(doc[field]);
					needsUpdate = true;
				}
			}
		}

		if (needsUpdate) {
			await db
				.collection(tableName)
				.updateOne({ _id: doc._id }, { $set: updates });
		}
	}
}

async function handleJoinTable(db, tableName, relation) {
	// For many-to-many join tables, we can either:
	// 1. Keep the join table as is, or
	// 2. Embed the relationships in the main documents

	// Here we'll implement option 2 (embedding)
	const joinData = await db.collection(tableName).find().toArray();

	// Process each side of the relationship
	await processJoinSide(
		db,
		joinData,
		relation.table1,
		relation.joinField1,
		relation.table2,
		relation.joinField2
	);
	await processJoinSide(
		db,
		joinData,
		relation.table2,
		relation.joinField2,
		relation.table1,
		relation.joinField1
	);

	// Optionally drop the join table if no longer needed
	// await db.collection(tableName).drop();
}

async function processJoinSide(
	db,
	joinData,
	mainTable,
	mainField,
	refTable,
	refField
) {
	const grouped = {};

	// Group join data by main table ID
	joinData.forEach((item) => {
		const mainId = item[mainField];
		const refId = item[refField];

		if (!grouped[mainId]) {
			grouped[mainId] = [];
		}
		grouped[mainId].push(refId);
	});

	// Update main table documents
	for (const [mainId, refIds] of Object.entries(grouped)) {
		const relationField = `${refTable.toLowerCase()}_ids`;

		await db
			.collection(mainTable)
			.updateOne(
				{ _id: new ObjectId(mainId) },
				{ $set: { [relationField]: refIds.map((id) => new ObjectId(id)) } }
			);
	}
}

// migrate().catch(console.error);

migrate().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
