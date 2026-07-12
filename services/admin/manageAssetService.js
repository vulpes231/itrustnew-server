const Asset = require("../../models/Asset");
const { CustomError } = require("../../utils/utils");

class ManageAssetService {
  async addNewAsset(formData) {
    const { symbol, name, type, exchange, price, imageUrl } = formData;

    if (!symbol || !name || !type || price == null) {
      throw new CustomError("Symbol, name, type and price are required.", 400);
    }

    const existingAsset = await Asset.findOne({
      symbol: symbol.toUpperCase(),
    });

    if (existingAsset) {
      throw new CustomError("Asset already exists.", 409);
    }

    try {
      const asset = await Asset.create({
        symbol: symbol.toUpperCase(),
        name,
        type,
        exchange,
        priceData: {
          current: Number(price),
        },
        imageUrl: imageUrl || null,
        isActive: true,
        isTradable: true,
        lastUpdated: new Date(),
        apiId: symbol.toUpperCase(),
      });

      // {
      //   symbol: symbol,
      //   name: profileData?.companyName || quoteData.name || symbol,
      //   type: "etf",
      //   exchange: mapExchange(quoteData.exchange || profileData?.exchange),
      //   priceData: {
      //     current: quoteData.price || 0,
      //     open: quoteData.open || null,
      //     previousClose: quoteData.previousClose || null,
      //     dayLow: quoteData.dayLow || null,
      //     dayHigh: quoteData.dayHigh || null,
      //     change: quoteData.change || null,
      //     changePercent: quoteData.changesPercentage || null,
      //     volume: quoteData.volume || null,
      //     avgVolume: quoteData.avgVolume || null,
      //   },
      //   historical: {
      //     yearLow: quoteData.yearLow || null,
      //     yearHigh: quoteData.yearHigh || null,
      //   },
      //   fundamentals: {
      //     marketCap: quoteData.marketCap || profileData?.mktCap || null,
      //     eps: null,
      //     pe: null,
      //     dividendYield: profileData?.lastDividendValue || null,
      //   },
      //   imageUrl: profileData?.image || null,
      //   isActive: true,
      //   isTradable: true,
      //   lastUpdated: new Date(),
      //   apiId: symbol,
      // }

      return asset;
    } catch (error) {
      throw new CustomError(error.message, 500);
    }
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
