import { AssetRepository, Asset } from '../repositories/assetRepository.js';
import { AssetConfigRepository, AssetConfig } from '../repositories/assetConfigRepository.js';

export class AssetService {
  private assetRepo: AssetRepository;
  private configRepo: AssetConfigRepository;

  constructor() {
    this.assetRepo = new AssetRepository();
    this.configRepo = new AssetConfigRepository();
  }

  async listAssets(): Promise<Asset[]> {
    return this.assetRepo.getAllActive();
  }

  async getAssetDetail(symbol: string): Promise<Asset> {
    const asset = await this.assetRepo.findBySymbol(symbol);
    if (!asset) {
      throw new Error(`Asset ${symbol} not found`);
    }

    return asset;
  }

  async getActiveConfigs(): Promise<AssetConfig[]> {
    return this.configRepo.getAllActive();
  }
}
