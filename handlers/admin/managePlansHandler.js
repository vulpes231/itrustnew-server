const {
  addNewPlan,
  removePlan,
  editPlan,
  fetchSinglePlan,
  editUserPlan,
} = require("../../services/admin/managePlansService");
const { fetchPlans } = require("../../services/user/autoPlanService");

const sharp = require("sharp");
const path = require("path");
const { generateFileName } = require("../../utils/utils");
const Autoplan = require("../../models/Autoplan");
const fs = require("fs").promises;

const STORAGE_PATH = path.join(__dirname, "../../storage/plans");

const createPlan = async (req, res, next) => {
  let savedImagePath = null;

  try {
    const planData = req.body;

    if (!req.file) {
      return res.status(400).json({
        message: "Plan image is required.",
        success: false,
      });
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    const planImg = req.file;

    if (!allowedMimeTypes.includes(planImg.mimetype)) {
      return res.status(400).json({
        message: "Only image files are allowed.",
        success: false,
      });
    }

    await fs.mkdir(STORAGE_PATH, { recursive: true });

    const planImageName = generateFileName(
      planImg.originalname,
      "planImg",
      planData.name,
    );

    const planImgPath = path.join(STORAGE_PATH, planImageName);
    savedImagePath = planImgPath;

    await sharp(planImg.buffer)
      .resize(800, 600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(planImgPath);

    planData.img = `/storage/plans/${planImageName}`;

    const planName = await addNewPlan(planData);

    res.status(201).json({
      message: `${planName} added successfully`,
      success: true,
    });
  } catch (error) {
    // Clean up: remove saved image if it exists and an error occurred
    if (savedImagePath) {
      try {
        await fs.unlink(savedImagePath);
        console.log(`Removed image at ${savedImagePath} due to error`);
      } catch (unlinkError) {
        console.error(
          `Failed to remove image at ${savedImagePath}:`,
          unlinkError,
        );
      }
    }
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  let savedImagePath = null;
  let oldImagePath = null;
  const { planId } = req.params;

  try {
    const existingPlan = await Autoplan.findById(planId);
    if (!existingPlan) {
      return res.status(404).json({
        message: "Plan not found.",
        success: false,
      });
    }

    const planData = { ...req.body, planId };

    if (req.file) {
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
      const planImg = req.file;

      if (!allowedMimeTypes.includes(planImg.mimetype)) {
        return res.status(400).json({
          message: "Only image files are allowed.",
          success: false,
        });
      }

      await fs.mkdir(STORAGE_PATH, { recursive: true });

      const planImageName = generateFileName(
        planImg.originalname,
        "planImg",
        planData.name || existingPlan.name,
      );

      const planImgPath = path.join(STORAGE_PATH, planImageName);
      savedImagePath = planImgPath;

      await sharp(planImg.buffer)
        .resize(800, 600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(planImgPath);

      planData.newImg = `/storage/plans/${planImageName}`;

      if (existingPlan.img) {
        oldImagePath = path.join(process.cwd(), existingPlan.img);
      }
    }

    const plan = await editPlan(planData);

    if (oldImagePath) {
      try {
        await fs.unlink(oldImagePath);
        console.log(`Removed old image at ${oldImagePath}`);
      } catch (unlinkError) {
        console.error(
          `Failed to remove old image at ${oldImagePath}:`,
          unlinkError,
        );
      }
    }

    res.status(200).json({
      message: `Plan updated successfully`,
      success: true,
      data: plan,
    });
  } catch (error) {
    if (savedImagePath) {
      try {
        await fs.unlink(savedImagePath);
        console.log(`Removed new image at ${savedImagePath} due to error`);
      } catch (unlinkError) {
        console.error(
          `Failed to remove image at ${savedImagePath}:`,
          unlinkError,
        );
      }
    }
    next(error);
  }
};

const deletePlan = async (req, res, next) => {
  const { planId } = req.params;
  try {
    const planName = await removePlan(planId);
    res.status(200).json({
      message: `${planName} deleted successfully`,
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const updateUserPlan = async (req, res, next) => {
  const form = req.body;

  try {
    await editUserPlan(form);
    res.status(200).json({
      message: `Plan edited successfully`,
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const singlePlan = async (req, res, next) => {
  const { planId } = req.params;
  try {
    const plan = await fetchSinglePlan(planId);
    res.status(200).json({
      message: `plan fetched successfully`,
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

const getMyPlans = async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 15);
  const sortBy = req.query.sortBy;

  try {
    const { plans, totalPage, totalResult } = await fetchPlans({
      page,
      limit,
      sortBy,
    });
    res.status(200).json({
      success: true,
      data: plans,
      pagination: {
        currentPage: page,
        perPage: limit,
        totalPages: totalPage,
        totalItems: totalResult,
      },
    });
  } catch (error) {
    // console.log(error);
    next(error);
  }
};

module.exports = {
  createPlan,
  updatePlan,
  deletePlan,
  singlePlan,
  getMyPlans,
  updateUserPlan,
};
