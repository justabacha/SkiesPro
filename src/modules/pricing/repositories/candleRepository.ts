import { PoolClient } from 'pg';
import { pgPool } from '../../../config/database';

export interface CandleRow {
  id: string;
  symbol: string;
  granularity_seconds: number;
  open_time: Date;
  close_time: Date;
  open_price: string;
  high_price: string;
  low_price: string;
  close_price: string;
  volume: string;
  created_at: Date;
}

export class CandleRepository {
  private client: PoolClient | typeof pgPool;

  constructor(client?: PoolClient) {
    this.client = client || pgPool;
  }

  async upsert(candle: Omit<CandleRow, 'id' | 'created_at'>): Promise<CandleRow> {
    const result = await this.client.query<CandleRow>(
      `INSERT INTO pricing.candles (
        symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (symbol, granularity_seconds, open_time) DO UPDATE SET
        high_price = GREATEST(pricing.candles.high_price, EXCLUDED.high_price),
        low_price = LEAST(pricing.candles.low_price, EXCLUDED.low_price),
        close_price = EXCLUDED.close_price,
        close_time = EXCLUDED.close_time,
        volume = pricing.candles.volume + EXCLUDED.volume
      RETURNING id, symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume, created_at`,
      [
        candle.symbol,
        candle.granularity_seconds,
        candle.open_time,
        candle.close_time,
        candle.open_price,
        candle.high_price,
        candle.low_price,
        candle.close_price,
        candle.volume,
      ]
    );
    return result.rows[0];
  }

  async getCandles(
    symbol: string,
    granularity: number,
    from: Date,
    to: Date,
    limit: number = 500
  ): Promise<CandleRow[]> {
    const result = await this.client.query<CandleRow>(
      `SELECT id, symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume, created_at
       FROM pricing.candles
       WHERE symbol = $1 AND granularity_seconds = $2 AND open_time >= $3 AND open_time <= $4
       ORDER BY open_time ASC
       LIMIT $5`,
      [symbol, granularity, from, to, limit]
    );
    return result.rows;
  }
}
