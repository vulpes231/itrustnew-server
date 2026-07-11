const manageAssetService = require("../../services/admin/manageAssetService");

const addAsset = async (req, res, next) => {
  try {
    const assetData = req.body;

    const asset = await manageAssetService.addNewAsset(assetData);
    res.status(200).json({
      message: `Asset added successfully.`,
      success: true,
      data: asset,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAsset = async (req, res, next) => {
  const { assetId } = req.params;
  try {
    const asset = await manageAssetService.removeAsset(assetId);

    res.status(200).json({
      message: `Asset deleted successfully.`,
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { addAsset, deleteAsset };
