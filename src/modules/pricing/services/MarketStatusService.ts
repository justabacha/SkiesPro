import { pgPool } from '../../../config/database';
import { PriceValidationService } from './priceValidationService';

export class MarketStatusService {
  constructor(private validationService: PriceValidationService) {}

  async isMarketOpen(symbol: string): Promise<boolean> {
    const result = await pgPool.query(
      `SELECT opens_at, closes_at, timezone, is_24_7 FROM pricing.market_hours WHERE asset_symbol = $1`,
      [symbol]
    );

    if (result.rowCount === 0) return true; // Default to open if not configured

    const hours = result.rows[0];
    if (hours.is_24_7) return true;

    // Check if feed is stale
    if (this.validationService.isStale(symbol)) {
      return false;
    }

    const now = new Date();
    const utcTime = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();

    const [openH, openM, openS] = hours.opens_at.split(':').map(Number);
    const openSecs = openH * 3600 + openM * 60 + openS;

    const [closeH, closeM, closeS] = hours.closes_at.split(':').map(Number);
    const closeSecs = closeH * 3600 + closeM * 60 + closeS;

    return utcTime >= openSecs && utcTime <= closeSecs;
  }

  async getMarketHours(symbol: string) {
    const result = await pgPool.query(
      `SELECT asset_symbol, opens_at, closes_at, timezone, is_24_7 FROM pricing.market_hours WHERE asset_symbol = $1`,
      [symbol]
    );
    return result.rows[0] || null;
  }
}
