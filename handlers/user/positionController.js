const positionService = require("../../services/user/positionService");

const getUserPositions = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const positions = await positionService.getUserPositionSummary(userId);

    res.status(200).json({
      message: "User positions fetched succesfully",
      data: positions,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUserPositions };
