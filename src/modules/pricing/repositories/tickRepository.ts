import { PoolClient } from 'pg';
import { pgPool } from '../../../config/database.js';

export type TickSource = 'live' | 'demo';

export interface TickRow {
  id: string;
  symbol: string;
  tick_time: Date;
  bid_price: string;
  ask_price: string;
  mid_price: string;
  volume: string;
  source: TickSource;
  created_at: Date;
}

export class TickRepository {
  private client: PoolClient | typeof pgPool;

  constructor(client?: PoolClient) {
    this.client = client || pgPool;
  }

  async save(tick: Omit<TickRow, 'id' | 'created_at'>): Promise<TickRow> {
    const result = await this.client.query<TickRow>(
      `INSERT INTO pricing.price_ticks
        (symbol, tick_time, bid_price, ask_price, mid_price, volume, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, symbol, tick_time, bid_price, ask_price, mid_price, volume, source, created_at`,
      [
        tick.symbol,
        tick.tick_time,
        tick.bid_price,
        tick.ask_price,
        tick.mid_price,
        tick.volume,
        tick.source,
      ]
    );
    return result.rows[0];
  }

  async saveBatch(ticks: Omit<TickRow, 'id' | 'created_at'>[]): Promise<void> {
    if (ticks.length === 0) return;

    const values: any[] = [];
    const placeholders = ticks
      .map((tick, i) => {
        const offset = i * 7;
        values.push(
          tick.symbol,
          tick.tick_time,
          tick.bid_price,
          tick.ask_price,
          tick.mid_price,
          tick.volume,
          tick.source
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
      })
      .join(', ');

    await this.client.query(
      `INSERT INTO pricing.price_ticks
        (symbol, tick_time, bid_price, ask_price, mid_price, volume, source)
       VALUES ${placeholders}`,
      values
    );
  }

  async getLatest(symbol: string, source: TickSource): Promise<TickRow | null> {
    const result = await this.client.query<TickRow>(
      `SELECT id, symbol, tick_time, bid_price, ask_price, mid_price, volume, source, created_at
       FROM pricing.price_ticks
       WHERE symbol = $1 AND source = $2
       ORDER BY tick_time DESC
       LIMIT 1`,
      [symbol, source]
    );
    return result.rows[0] || null;
  }

  async getPriceAt(symbol: string, time: Date, source: TickSource): Promise<TickRow | null> {
    const result = await this.client.query<TickRow>(
      `SELECT id, symbol, tick_time, bid_price, ask_price, mid_price, volume, source, created_at
       FROM pricing.price_ticks
       WHERE symbol = $1 AND source = $2 AND tick_time <= $3
       ORDER BY tick_time DESC
       LIMIT 1`,
      [symbol, source, time]
    );
    return result.rows[0] || null;
  }

  async pruneExpiredDemoTicks(retentionDays: number): Promise<number> {
    const result = await this.client.query<{ deleted_count: string }>(
      'SELECT pricing.prune_expired_demo_ticks($1) AS deleted_count',
      [retentionDays]
    );
    return Number(result.rows[0]?.deleted_count || 0);
  }
}
