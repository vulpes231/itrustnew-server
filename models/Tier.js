const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const tierSchema = new Schema(
  {
    title: { type: String },
    tag: { type: String },
    threshold: { type: Number },
    minDeposit: { type: Number },
    features: { type: [String] },
  },
  { timestamps: true },
);

const Tier = mongoose.model("Tier", tierSchema);
module.exports = Tier;
