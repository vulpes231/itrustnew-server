const Autoplan = require("../../models/Autoplan");
const Trade = require("../../models/Trade");
const User = require("../../models/User");
const { CustomError } = require("../../utils/utils");
const fs = require("fs").promises;
const path = require("path");

async function addNewPlan(planData) {
  const {
    name,
    title,
    type,
    min,
    winRate,
    expectedReturn,
    dailyReturn,
    aum,
    milestone,
    duration,
    img,
  } = planData;

  if (
    !name ||
    !type ||
    !min ||
    !winRate ||
    !expectedReturn ||
    !dailyReturn ||
    !aum ||
    !milestone ||
    !duration ||
    !img
  ) {
    throw new CustomError("Incomplete plan data!", 400);
  }

  try {
    const newPlanData = {
      name,
      title,
      planType: type,
      minInvestment: min,
      performance: {
        winRate,
        expectedReturnPercent: expectedReturn,
        dailyReturnPercent: dailyReturn,
        aum,
      },
      expiresIn: {
        milestone,
        duration,
      },
      img,
    };

    const planCreated = await Autoplan.create(newPlanData);
    return planCreated.name;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function editPlan(planData) {
  const {
    planId,
    name,
    title,
    type,
    min,
    winRate,
    aum,
    expectedReturn,
    dailyReturn,
    milestone,
    duration,
    newImg,
  } = planData;

  if (!planId) {
    throw new CustomError("Bad request! Plan ID is required.", 400);
  }

  try {
    const updateFields = {};

    if (name !== undefined && name !== "") {
      updateFields.name = name;
    }

    if (title !== undefined && title !== "") {
      updateFields.title = title;
    }

    if (type !== undefined && type !== "") {
      updateFields.planType = type;
    }

    if (min !== undefined && min !== "") {
      updateFields.minInvestment = parseFloat(min);
    }
    if (newImg !== undefined && newImg !== "") {
      updateFields.img = newImg;
    }

    if (winRate !== undefined && winRate !== "") {
      updateFields["performance.winRate"] = parseFloat(winRate);
    }

    if (expectedReturn !== undefined && expectedReturn !== "") {
      updateFields["performance.expectedReturnPercent"] =
        parseFloat(expectedReturn);
    }

    if (dailyReturn !== undefined && dailyReturn !== "") {
      updateFields["performance.dailyReturnPercent"] = parseFloat(dailyReturn);
    }

    if (aum !== undefined && aum !== "") {
      updateFields["performance.aum"] = aum.toString();
    }

    if (milestone !== undefined && milestone !== "") {
      updateFields["expiresIn.milestone"] = parseFloat(milestone);
    }

    if (duration !== undefined && duration !== "") {
      updateFields["expiresIn.duration"] = duration;
    }

    if (Object.keys(updateFields).length === 0) {
      throw new CustomError("No valid fields to update!", 400);
    }

    const plan = await Autoplan.findByIdAndUpdate(
      planId,
      {
        $set: updateFields,
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      },
    );

    if (!plan) {
      throw new CustomError("Plan not found!", 404);
    }

    // console.log("Plan updated successfully:", plan._id);

    return plan;
  } catch (error) {
    console.error("Error in editPlan:", error);

    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(`Failed to update plan: ${error.message}`, 500);
  }
}

async function removePlan(planId) {
  try {
    const plan = await Autoplan.findById(planId);

    if (!plan) {
      throw new CustomError("Plan not found!", 404);
    }

    const positionCount = await Trade.countDocuments({ planId: plan._id });
    if (positionCount > 0) {
      throw new CustomError("You have open trades with this plan!", 403);
    }

    if (plan.img) {
      try {
        const imagePath = path.join(STORAGE_PATH, path.basename(plan.img));

        await fs.access(imagePath);
        await fs.unlink(imagePath);
        console.log(`Deleted plan image: ${imagePath}`);
      } catch (fileError) {
        if (fileError.code === "ENOENT") {
          console.warn(`Image file not found: ${plan.img}`);
        } else {
          console.error(`Error deleting image file: ${fileError.message}`);
        }
      }
    }

    await Autoplan.findByIdAndDelete(plan._id);

    return true;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

async function fetchSinglePlan(planId) {
  try {
    const plan = await Autoplan.findById(planId).lean();
    if (plan) {
      throw new CustomError("Invalid plan!", 404);
    }
    return plan;
  } catch (error) {
    throw new CustomError(error.message, 500);
  }
}

async function editUserPlan(form) {
  const { planId, userId, start, end } = form;

  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new CustomError("User not found!", 404);
    }

    const userPlan = user.activePlans.id(planId);

    if (!userPlan) {
      throw new CustomError("Plan not found!", 404);
    }

    if (start) {
      userPlan.start = new Date(start);
    }

    if (end) {
      userPlan.end = new Date(end);
    }

    const now = new Date();
    if (userPlan.end && userPlan.end <= now) {
      userPlan.status = "closed";
    }

    await user.save();

    return userPlan;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message, 500);
  }
}

module.exports = {
  addNewPlan,
  editPlan,
  removePlan,
  fetchSinglePlan,
  editUserPlan,
};
