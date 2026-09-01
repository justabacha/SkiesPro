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

  async getAssetDetail(symbol: string): Promise<{ asset: Asset; config: AssetConfig | null }> {
    const asset = await this.assetRepo.findBySymbol(symbol);
    if (!asset) {
      throw new Error(`Asset ${symbol} not found`);
    }

    const config = await this.configRepo.findBySymbol(symbol);
    return { asset, config };
  }

  async getActiveConfigs(): Promise<AssetConfig[]> {
    return this.configRepo.getAllActive();
  }
}
