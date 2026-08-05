const { default: mongoose } = require("mongoose");
const Article = require("../models/Articles");
const { CustomError } = require("../utils/utils");

class ArticleService {
  async createArticle(articleData) {
    const { img, content, title, topic, isAsk } = articleData;

    if (!title?.trim() || !topic?.trim() || !content?.trim() || !img?.trim())
      throw new CustomError("Bad request!", 400);

    const createdArticle = await Article.create({
      title,
      topic,
      content,
      img,
      isAsk,
    });

    return createdArticle;
  }

  async fetchArticles() {
    const articles = await Article.find().sort({ createdAt: -1 }).lean();

    return articles;
  }

  async fetchArticleById(articleId) {
    if (!articleId) throw new CustomError("Bad request!", 400);
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      throw new CustomError("Invalid article id.", 400);
    }
    const article = await Article.findById(articleId).lean();
    if (!article) throw new CustomError("Article not found!", 404);

    return article;
  }

  async editArticle(articleData) {
    const { img, content, title, topic, isAsk, articleId } = articleData;
    if (!articleId) throw new CustomError("Bad request!", 400);
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      throw new CustomError("Invalid article id.", 400);
    }
    const article = await Article.findById(articleId);
    if (!article) throw new CustomError("Article not found!", 404);

    const imagePathtoDelete = article.img;

    if (img) article.img = img;
    if (title) article.title = title;
    if (topic) article.topic = topic;
    if (content) article.content = content;
    if (typeof isAsk === "boolean") {
      article.isAsk = isAsk;
    }

    await article.save();

    return { article, imgPath: imagePathtoDelete };
  }

  async deleteArticle(articleId) {
    if (!articleId) throw new CustomError("Bad request!", 400);
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      throw new CustomError("Invalid article id.", 400);
    }
    const deletedArticle = await Article.findByIdAndDelete(articleId);
    if (!deletedArticle) throw new CustomError("Article not found!", 404);

    return { isDeleted: true, imgPath: deletedArticle.img };
  }
}

module.exports = new ArticleService();
