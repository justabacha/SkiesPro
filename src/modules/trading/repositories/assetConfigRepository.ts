import { pgPool } from '../../../config/database.js';

export interface AssetConfig {
  id: string;
  assetSymbol: string;
  minStake: number;
  maxStake: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  payoutRate: number;
  isActive: boolean;
  maxExposure: number; // Corrected to match DDS §5.15
  volatilityMultiplier?: number;
  updatedBy?: string;
  validFrom?: Date;
  validUntil?: Date;
  createdAt: Date;
}

export class AssetConfigRepository {
  async findBySymbol(symbol: string): Promise<AssetConfig | null> {
    // Note: Column names might be payout_rate or payout_ratio depending on migration state
    // But our migration 022 and 031 should have standardized it to payout_rate.
    const query = `
      SELECT
        id, asset_symbol as "assetSymbol", min_stake as "minStake",
        max_stake_per_trade as "maxStake", min_duration_seconds as "minDurationSeconds",
        max_duration_seconds as "maxDurationSeconds", payout_rate as "payoutRate",
        is_active as "isActive", max_exposure as "maxExposure"
      FROM trading.asset_config
      WHERE asset_symbol = $1 AND is_active = TRUE
    `;
    const { rows } = await pgPool.query(query, [symbol]);
    return rows[0] || null;
  }

  async getAllActive(): Promise<AssetConfig[]> {
    const query = `
      SELECT
        id, asset_symbol as "assetSymbol", min_stake as "minStake",
        max_stake_per_trade as "maxStake", min_duration_seconds as "minDurationSeconds",
        max_duration_seconds as "maxDurationSeconds", payout_rate as "payoutRate",
        is_active as "isActive", max_exposure as "maxExposure"
      FROM trading.asset_config
      WHERE is_active = TRUE
    `;
    const { rows } = await pgPool.query(query);
    return rows;
  }
}
