const { Router } = require("express");

const sanitizeArticle = require("../../middlewares/sanitizeArticle");

const {
  AddNewArticle,
  updateArticle,
  removeArticle,
} = require("../../handlers/admin/manageArticleHandler");
const { upload } = require("../../utils/utils");

const router = Router();

router
  .route("/")
  .post(upload.single("articleImg"), sanitizeArticle, AddNewArticle);

router.patch("/:articleId", sanitizeArticle, updateArticle);

router.delete("/:articleId", removeArticle);

module.exports = router;
