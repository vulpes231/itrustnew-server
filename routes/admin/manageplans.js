const { Router } = require("express");
const {
  createPlan,
  updatePlan,
  deletePlan,
  singlePlan,
  getMyPlans,
  updateUserPlan,
} = require("../../handlers/admin/managePlansHandler");

const multer = require("multer");

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

const router = Router();

router.route("/").get(getMyPlans).post(upload.single("planImg"), createPlan);
router.route("/user").patch(updateUserPlan);
router
  .route("/:planId")
  .get(singlePlan)
  .patch(upload.single("planImg"), updatePlan)
  .delete(deletePlan);

module.exports = router;
