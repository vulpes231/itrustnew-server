const { Router } = require("express");

const {
  getSingleArticle,
  getArticles,
} = require("../handlers/articleController");

const router = Router();

router.route("/").get(getArticles);

router.route("/:articleId").get(getSingleArticle);

module.exports = router;
