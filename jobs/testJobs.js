const User = require("../models/User");
const Wallet = require("../models/Wallet");

async function doSomething() {
	try {
		console.log("Starting to do something");
		const users = await User.find();

		if (users.length === 0) {
			console.log("Found 0 users");
			return;
		}
		const BATCH_SIZE = 10;
		let processed = 0;

		for (let i = 0; i < users.length; i += BATCH_SIZE) {
			const userBatch = users.slice(i, i + BATCH_SIZE);

			for (const user of userBatch) {
				const userWallets = await Wallet.find({ userId: user._id });

				if (userWallets.length === 0) {
					console.log("Found 0 wallets");
					return;
				}

				for (const wallet of userWallets) {
					wallet.totalBalance = 0;
					wallet.availableBalance = 1;
				}
			}
			processed++;
		}
		console.log(
			`Processed ${processed} of ${Math.ceil(
				users.length / BATCH_SIZE
			)} batches`
		);
		jobL;
	} catch (error) {
		console.log(error);
	}
}
