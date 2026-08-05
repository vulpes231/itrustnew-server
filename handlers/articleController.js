const articleService = require("../services/articleService");

const getArticles = (req, res, next) => {
  try {
    const articles = articleService.fetchArticles();

    res.status(200).json({
      message: "Articles fetched successfully.",
      success: true,
      data: articles,
    });
  } catch (error) {
    next(error);
  }
};

const getSingleArticle = (req, res, next) => {
  const { articleId } = req.params;
  try {
    const article = articleService.fetchArticleById(articleId);

    res.status(200).json({
      message: "Article fetched successfully.",
      success: true,
      data: article,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getArticles, getSingleArticle };
