const { default: axios } = require("axios");
const Asset = require("../../models/Asset");
const {
  CustomError,
  transformStock,
  transformToETFAsset,
  transformCrypto,
  fetchQuote,
  fetchProfile,
  fetchKeyMetrics,

  fetchETFInfo,
} = require("../../utils/utils");

class ManageAssetService {
  async addNewAsset(formData) {
    const { ticker, type } = formData;

    if (!ticker || !type) {
      throw new CustomError("Ticker and asset type are required.", 400);
    }

    const symbol = ticker.trim().toUpperCase();

    if (!["stock", "etf", "crypto"].includes(type)) {
      throw new CustomError("Invalid asset type.", 400);
    }

    const existingAsset = await Asset.findOne({ symbol });

    if (existingAsset) {
      throw new CustomError("Asset already exists.", 409);
    }

    let asset;

    try {
      switch (type) {
        case "stock":
          asset = await this.fetchStock(symbol);
          break;

        case "etf":
          asset = await this.fetchETF(symbol);
          break;

        case "crypto":
          asset = await this.fetchCrypto(symbol);
          break;
      }

      if (!asset) {
        throw new CustomError(`${symbol} was not found as a ${type}.`, 404);
      }

      return await Asset.create(asset);
    } catch (error) {
      if (error instanceof CustomError) throw error;

      throw new CustomError(error.message, 500);
    }
  }

  async fetchETF(symbol) {
    const [quote, profile, etfInfo] = await Promise.all([
      fetchQuote(symbol),
      fetchProfile(symbol),
      fetchETFInfo(symbol),
    ]);

    if (!quote) {
      return null;
    }

    return transformToETFAsset(symbol, quote, profile, etfInfo);
  }

  async fetchStock(symbol) {
    const [quote, profile, metrics] = await Promise.all([
      fetchQuote(symbol),
      fetchProfile(symbol),
      fetchKeyMetrics(symbol),
    ]);

    if (!quote) {
      return null;
    }

    return transformStock(symbol, quote, profile, metrics);
  }

  async fetchCrypto(symbol) {
    const quote = await fetchQuote(symbol);

    if (!quote) {
      return null;
    }

    if (
      quote.type?.toLowerCase() !== "crypto" &&
      quote.assetType?.toLowerCase() !== "crypto"
    ) {
      return null;
    }

    return transformCrypto(symbol, quote);
  }

  async removeAsset(assetId) {
    if (!assetId) {
      throw new CustomError("Asset ID is required.", 400);
    }

    try {
      const asset = await Asset.findByIdAndDelete(assetId);

      if (!asset) {
        throw new CustomError("Asset not found.", 404);
      }

      return asset;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(error.message, 500);
    }
  }
}

module.exports = new ManageAssetService();
