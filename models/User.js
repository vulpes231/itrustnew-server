const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    name: {
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
    },
    credentials: {
      username: {
        type: String,
        required: true,
        unique: true,
      },
      password: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
        unique: true,
      },
      refreshToken: {
        type: String,
      },
      passUpdatedAt: {
        type: Date,
      },
    },
    contactInfo: {
      phone: {
        type: String,
      },
      address: {
        street: {
          type: String,
        },
        city: {
          type: String,
        },
        zipCode: {
          type: String,
        },
        isVerified: {
          type: String,
          default: "not verified",
          enum: ["not verified", "pending", "verified"],
        },
      },
    },
    locationDetails: {
      country: {
        countryId: { type: Schema.Types.ObjectId, ref: "Country" },
        name: { type: String },
        phoneCode: { type: String },
      },
      state: {
        stateId: { type: Schema.Types.ObjectId, ref: "State" },
        name: { type: String },
      },
      nationality: {
        id: { type: Schema.Types.ObjectId, ref: "Nationality" },
        name: { type: String },
      },
      currency: {
        id: { type: Schema.Types.ObjectId, ref: "Currency" },
        name: { type: String },
        symbol: { type: String },
        sign: { type: String },
        rate: { type: String },
      },
    },
    personalDetails: {
      avatar: {
        type: String,
      },
      dob: {
        type: Date,
      },
      ssn: {
        type: String,
      },
    },
    professionalInfo: {
      experience: {
        type: String,
      },
      employment: {
        type: String,
      },
      employmentInfo: {
        employerName: { type: String },
        position: { type: String },
        taxBracket: { type: String },
        liquidNet: { type: String },
        estimatedNet: { type: String },
        annualIncome: { type: String },
        expYears: { type: String },
      },
      investmentInfo: {
        riskTolerance: { type: String },
        objectives: { type: [String] },
        retiring: { type: String },
      },
    },
    identityVerification: {
      idType: {
        type: String,
      },
      idNumber: {
        type: String,
      },
      idFront: {
        type: String,
      },
      idBack: {
        type: String,
      },
      kycStatus: {
        type: String,
        enum: ["not verified", "pending", "approved", "failed"],
        default: "not verified",
      },
    },
    accountStatus: {
      status: {
        type: String,
        default: "active",
      },
      isProfileComplete: {
        type: Boolean,
        default: false,
      },
      banned: {
        type: Boolean,
        default: false,
      },
      emailVerified: {
        type: Boolean,
        default: false,
      },
      twoFaActivated: {
        type: Boolean,
        default: false,
      },
      twoFaVerified: {
        type: Boolean,
        default: false,
      },
      otp: {
        type: String,
      },
      otpExpires: {
        type: Date,
      },
      otpAttempts: {
        type: Number,
        default: 0,
      },
      otpBlockedUntil: {
        type: Date,
      },
    },
    savingsAccounts: [
      {
        name: { type: String },
        symbol: { type: String },
        title: { type: String },
        tag: { type: String },
        rate: { type: Number },
        canTrade: { type: Boolean },
        accountId: { type: Schema.Types.ObjectId, ref: "Savingsaccount" },
        analytics: {
          totalReturn: { type: Number, default: 0 },
          dailyChange: { type: Number, default: 0 },
          balance: { type: Number, default: 0 },
          contributions: { type: Number, default: 0 },
          withdrawals: { type: Number, default: 0 },
        },
      },
    ],
    activePlans: [
      {
        name: { type: String },
        title: { type: String },
        status: { type: String },
        aum: { type: String },
        min: { type: String },
        image: { type: String },
        duration: { type: String },
        start: { type: Date },
        end: { type: Date },
        planId: { type: Schema.Types.ObjectId, ref: "Autoplan" },
        analytics: {
          dailyReturn: { type: Number },
          expectedReturn: { type: Number },
          winRate: { type: Number },
        },
      },
    ],
    role: {
      type: String,
      enum: ["0000"],
      default: "0000",
    },
  },
  { timestamps: true }
);

userSchema.virtual("fullName").get(function () {
  return `${this.name.firstName} ${this.name.lastName}`;
});

const User = mongoose.model("User", userSchema);
module.exports = User;
