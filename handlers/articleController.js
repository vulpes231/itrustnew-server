const articleService = require("../services/articleService");

const getArticles = async (req, res, next) => {
  try {
    const articles = await articleService.fetchArticles();

    console.log(articles);

    res.status(200).json({
      message: "Articles fetched successfully.",
      success: true,
      data: articles,
    });
  } catch (error) {
    next(error);
  }
};

const getSingleArticle = async (req, res, next) => {
  const { articleId } = req.params;
  try {
    const article = await articleService.fetchArticleById(articleId);

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
