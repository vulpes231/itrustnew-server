const crypto = require("crypto");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const articleService = require("../../services/articleService");

const IMG_STORAGE_PATH = path.join(__dirname, "../../storage/articles");
const PUBLIC_STORAGE_PATH = "/storage/articles";

const generateFileName = (type) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");

  return `${type}_${timestamp}_${randomString}.webp`;
};

const AddNewArticle = async (req, res, next) => {
  let articleFilePath;
  try {
    const { title, topic, content, isAsk } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Article image is required.",
      });
    }

    const articleImage = req.file;

    await fs.mkdir(IMG_STORAGE_PATH, { recursive: true });

    const articleFileName = generateFileName("article");
    articleFilePath = path.join(IMG_STORAGE_PATH, articleFileName);

    await sharp(articleImage.buffer)
      .resize(800, 600, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(articleFilePath);

    const article = await articleService.createArticle({
      title,
      topic,
      content,
      img: `${PUBLIC_STORAGE_PATH}/${articleFileName}`,
      isAsk,
    });

    return res.status(201).json({
      success: true,
      message: "Article created successfully.",
      data: article,
    });
  } catch (error) {
    if (articleFilePath) {
      await fs.unlink(articleFilePath).catch(() => {});
    }
    next(error);
  }
};

const updateArticle = async (req, res, next) => {
  const { articleId } = req.params;
  const articleData = req.body;

  let articleFilePath;
  let imagePath;

  try {
    if (req.file) {
      const articleImage = req.file;

      await fs.mkdir(IMG_STORAGE_PATH, { recursive: true });

      const articleFileName = generateFileName("article");
      articleFilePath = path.join(IMG_STORAGE_PATH, articleFileName);

      await sharp(articleImage.buffer)
        .resize(800, 600, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(articleFilePath);

      imagePath = `${PUBLIC_STORAGE_PATH}/${articleFileName}`;
    }

    const { article, imgPath } = await articleService.editArticle({
      ...articleData,
      articleId,
      img: imagePath,
    });

    if (imgPath) {
      const oldImagePath = path.join(
        __dirname,
        "../../",
        imgPath.replace(/^\//, ""),
      );

      await fs.unlink(oldImagePath).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: "Article updated successfully.",
      data: article,
    });
  } catch (error) {
    if (articleFilePath) {
      await fs.unlink(articleFilePath).catch(() => {});
    }

    next(error);
  }
};

const removeArticle = async (req, res, next) => {
  const { articleId } = req.params;
  try {
    const { isDeleted, imgPath } =
      await articleService.deleteArticle(articleId);

    if (imgPath) {
      const oldImagePath = path.join(
        __dirname,
        "../../",
        imgPath.replace(/^\//, ""),
      );

      await fs.unlink(oldImagePath).catch(() => {});
    }

    res.status(200).json({
      message: "Article deleted successfully.",
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  AddNewArticle,
  updateArticle,
  removeArticle,
};
