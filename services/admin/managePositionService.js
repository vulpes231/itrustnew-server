const Position = require("../../models/Position");
const { CustomError } = require("../../utils/utils");

class ManagePositionService {
  async fetchAllPositions() {
    const positions = await Position.find().lean();
    return positions;
  }

  async fetchPositionInfo(positionId) {
    if (!positionId) throw new CustomError("Position ID required!", 400);

    const position = await Position.findById(positionId);
    if (!position) throw new CustomError("Position not found!", 404);
    return position;
  }

  async editPositionData(positionData) {
    const { positionId, customDate, extra } = positionData;

    if (!positionId) throw new CustomError("Position ID required!", 400);

    const position = await Position.findById(positionId);
    if (!position) throw new CustomError("Position not found!", 404);

    if (customDate) position.customDate = customDate;
    if (extra) {
      //a position is an aggregation of orders by account traded from and asset split the extra accross the order on this position based on amount invetsed on each order e.g order of 50 takes less percent of extra than a order of 100 and so on
    }
    return;
  }

  async deletePosition(positionId) {
    const deletedPosition = await Position.findByIdAndDelete(positionId);
    if (!deletedPosition) throw new CustomError("Position not found!", 404);
    // delete all trade orders in this positions too
    return true;
  }
}

module.exports = new ManagePositionService();
