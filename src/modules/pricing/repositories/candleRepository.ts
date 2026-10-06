import { PoolClient } from 'pg';
import { pgPool } from '../../../config/database.js';

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
  source: string;
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
        symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (symbol, granularity_seconds, open_time, source) DO UPDATE SET
        high_price = GREATEST(pricing.candles.high_price, EXCLUDED.high_price),
        low_price = LEAST(pricing.candles.low_price, EXCLUDED.low_price),
        close_price = EXCLUDED.close_price,
        close_time = EXCLUDED.close_time,
        volume = pricing.candles.volume + EXCLUDED.volume
      RETURNING id, symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume, source, created_at`,
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
        candle.source,
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
      `SELECT * FROM (
         SELECT id, symbol, granularity_seconds, open_time, close_time, open_price,
                high_price, low_price, close_price, volume, source, created_at
         FROM pricing.candles
         WHERE symbol = $1 AND granularity_seconds = $2 AND open_time >= $3 AND open_time <= $4
         ORDER BY open_time DESC
         LIMIT $5
       ) recent
       ORDER BY open_time ASC`,
      [symbol, granularity, from, to, limit]
    );
    return result.rows;
  }

  async getAggregatedCandles(
    symbol: string,
    granularity: number,
    from: Date,
    to: Date,
    limit: number = 500
  ): Promise<CandleRow[]> {
    const result = await this.client.query<CandleRow>(
      `SELECT
         'bucket_' || extract(epoch from open_time)::bigint || '_' || source AS id,
         $1 AS symbol,
         $2::integer AS granularity_seconds,
         source,
         open_time,
         close_time,
         open_price,
         high_price,
         low_price,
         close_price,
         volume,
         open_time AS created_at
       FROM (
         SELECT
           to_timestamp(floor(extract(epoch from open_time) / $2) * $2) AS open_time,
           source,
           to_timestamp(floor(extract(epoch from open_time) / $2) * $2) + ($2 * interval '1 second') - interval '1 millisecond' AS close_time,
           (ARRAY_AGG(open_price ORDER BY open_time ASC))[1] AS open_price,
           MAX(high_price) AS high_price,
           MIN(low_price) AS low_price,
           (ARRAY_AGG(close_price ORDER BY open_time DESC))[1] AS close_price,
           COALESCE(SUM(volume), 0)::text AS volume
         FROM pricing.candles
         WHERE symbol = $1
           AND granularity_seconds = 60
           AND open_time >= $3
           AND open_time <= $4
         GROUP BY floor(extract(epoch from open_time) / $2), source
         ORDER BY open_time DESC
         LIMIT $5
       ) recent
       ORDER BY open_time ASC`,
      [symbol, granularity, from, to, limit]
    );
    return result.rows;
  }
}
