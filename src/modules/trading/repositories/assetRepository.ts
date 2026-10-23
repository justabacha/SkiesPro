import { pgPool } from '../../../config/database.js';

export interface Asset {
  symbol: string;
  name: string;
  assetType: string;
  isActive: boolean;
  payoutRate: string | null;
  minStake: string | null;
  maxStake: string | null;
  minExpirySeconds: number;
  maxExpirySeconds: number;
  pipDecimalPlaces: number;
}

export class AssetRepository {
  async findBySymbol(symbol: string): Promise<Asset | null> {
    const query = `
      SELECT a.*, a.asset_type AS "assetType", a.is_active AS "isActive",
             a.pip_decimal_places AS "pipDecimalPlaces",
             ac.payout_rate AS "payoutRate", ac.min_stake AS "minStake",
             ac.max_stake_per_trade AS "maxStake"
      FROM trading.assets a
      LEFT JOIN trading.asset_config ac ON a.symbol = ac.asset_symbol
      WHERE a.symbol = $1 AND a.is_active = TRUE
    `;
    const { rows } = await pgPool.query(query, [symbol]);
    return rows[0] || null;
  }

  async getAllActive(): Promise<Asset[]> {
    const query = `
      SELECT a.*, a.asset_type AS "assetType", a.is_active AS "isActive",
             a.pip_decimal_places AS "pipDecimalPlaces",
             ac.payout_rate AS "payoutRate", ac.min_stake AS "minStake",
             ac.max_stake_per_trade AS "maxStake"
      FROM trading.assets a
      LEFT JOIN trading.asset_config ac ON a.symbol = ac.asset_symbol
      WHERE a.is_active = TRUE
    `;
    const { rows } = await pgPool.query(query);
    return rows;
  }
}
