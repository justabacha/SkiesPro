import { pgPool } from '../../../config/database.js';

export interface Asset {
  symbol: string;
  name: string;
  assetType: string;
  isActive: boolean;
  minStake: number;
  maxStake: number;
  minExpirySeconds: number;
  maxExpirySeconds: number;
  pipDecimalPlaces: number;
}

export class AssetRepository {
  async findBySymbol(symbol: string): Promise<Asset | null> {
    const query = `
      SELECT *, pip_decimal_places AS "pipDecimalPlaces"
      FROM trading.assets
      WHERE symbol = $1 AND is_active = TRUE
    `;
    const { rows } = await pgPool.query(query, [symbol]);
    return rows[0] || null;
  }

  async getAllActive(): Promise<Asset[]> {
    const query = `
      SELECT *, asset_type AS "assetType", is_active AS "isActive",
             pip_decimal_places AS "pipDecimalPlaces"
      FROM trading.assets
      WHERE is_active = TRUE
    `;
    const { rows } = await pgPool.query(query);
    return rows;
  }
}
