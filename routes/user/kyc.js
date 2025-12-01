const { Router } = require("express");
const { submitDetails } = require("../../handlers/user/verifyController");

const multer = require("multer");
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

router.route("/").post(upload.array("idImages", 2), submitDetails);

module.exports = router;
