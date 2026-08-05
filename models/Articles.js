const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const articleSchema = new Schema(
  {
    title: {
      type: String,
    },
    topic: {
      type: String,
      enum: [
        "business",
        "news",
        "investing",
        "savings",
        "retirement",
        "technology",
        "management",
        "trends",
      ],
    },
    content: {
      type: String,
    },
    img: {
      type: String,
    },
    isAsk: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const Article = mongoose.model("Article", articleSchema);

module.exports = Article;
