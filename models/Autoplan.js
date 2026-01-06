const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const autoPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    planType: {
      type: String,
      required: true,
      enum: ["conservative", "moderate", "aggressive"],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    minInvestment: {
      type: Number,
      required: true,
      min: 0,
    },
    performance: {
      winRate: {
        type: Number,
      },
      expectedReturnPercent: {
        type: Number,
      },
      dailyReturnPercent: {
        type: Number,
      },
      aum: {
        type: String,
      },
    },
    expiresIn: {
      milestone: {
        type: Number,
        required: true,
      },
      duration: {
        type: String,
        enum: ["day", "week", "month", "year"],
      },
    },
    img: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

autoPlanSchema.index({ name: 1, planType: 1 });
autoPlanSchema.index({ "investmentRange.min": 1, "investmentRange.max": 1 });
autoPlanSchema.index({ "performance.winRate": -1 });

autoPlanSchema.virtual("formattedDuration").get(function () {
  return `${this.expiresIn.milestone} ${this.expiresIn.duration}`;
});

const Autoplan = mongoose.model("Autoplan", autoPlanSchema);
module.exports = Autoplan;
