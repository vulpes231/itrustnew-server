const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const walletSettingSchema = new Schema(
	{
		cryptoWallets: {
			btc: { type: String },
			eth: { type: String },
			trc: { type: String },
			erc: { type: String },
			note: { type: String, default: "Default note" },
		},
		bankDetails: {
			name: { type: String },
			accountName: { type: String },
			accountNumber: { type: String },
			routingNumber: { type: String },
			reference: { type: String },
			address: { type: String },
		},
		depositLimits: {
			bank: {
				min: { type: Number },
				max: { type: Number },
			},
			crypto: {
				min: { type: Number },
				max: { type: Number },
			},
		},
		withdrawalLimits: {
			bank: {
				min: { type: Number },
				max: { type: Number },
			},
			crypto: {
				min: { type: Number },
				max: { type: Number },
			},
		},
	},
	{ timestamps: true }
);

const WalletSetting = mongoose.model("WalletSetting", walletSettingSchema);
module.exports = WalletSetting;
