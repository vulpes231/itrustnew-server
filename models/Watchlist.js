const { default: mongoose } = require("mongoose");

const Schema = mongoose.Schema;

const watchlistSchema = new Schema({
	name: {
		type: String,
	},
	userId: {
		type: Schema.Types.ObjectId,
		ref: "User",
	},
	assetId: {
		type: Schema.Types.ObjectId,
		ref: "Asset",
	},
	img: {
		type: String,
	},
	price: {
		type: Number,
	},
	symbol: {
		type: String,
	},
});

const Watchlist = mongoose.model("Watchlist", watchlistSchema);
module.exports = Watchlist;
