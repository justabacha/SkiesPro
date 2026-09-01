import { pgPool } from '../../../config/database.js';

export interface AssetConfig {
  id: string;
  assetSymbol: string;
  minStake: string; // Keep as string for precision
  maxStake: string; // Keep as string for precision
  minDurationSeconds: number;
  maxDurationSeconds: number;
  payoutRate: string; // Keep as string for precision
  isActive: boolean;
  maxExposure: string; // Keep as string for precision
  volatilityMultiplier?: string;
  updatedBy?: string;
  validFrom?: Date;
  validUntil?: Date;
  createdAt: Date;
}

export class AssetConfigRepository {
  async findBySymbol(symbol: string): Promise<AssetConfig | null> {
    const query = `
      SELECT
        id, asset_symbol as "assetSymbol", min_stake as "minStake",
        max_stake_per_trade as "maxStake", min_duration_seconds as "minDurationSeconds",
        max_duration_seconds as "maxDurationSeconds", payout_rate as "payoutRate",
        is_active as "isActive", max_exposure as "maxExposure",
        created_at as "createdAt"
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
        is_active as "isActive", max_exposure as "maxExposure",
        created_at as "createdAt"
      FROM trading.asset_config
      WHERE is_active = TRUE
    `;
    const { rows } = await pgPool.query(query);
    return rows;
  }
}
