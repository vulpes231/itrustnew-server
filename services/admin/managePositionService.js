const Position = require("../../models/Position");
const { CustomError } = require("../../utils/utils");

class ManagePositionService {
  async fetchAllPositions() {
    const positions = await Position.find().lean();
    return positions;
  }
}

module.exports = new ManagePositionService();
