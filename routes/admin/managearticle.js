const { Router } = require("express");

const sanitizeArticle = require("../../middlewares/sanitizeArticle");

const {
  AddNewArticle,
  updateArticle,
  removeArticle,
} = require("../../handlers/admin/manageArticleHandler");

const router = Router();

router.post("/", sanitizeArticle, AddNewArticle);

router.patch("/:articleId", sanitizeArticle, updateArticle);

router.delete("/:articleId", removeArticle);

module.exports = router;
