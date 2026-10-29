import { TickRetentionJob } from '../../../src/modules/pricing/jobs/TickRetentionJob.js';
import { pgPool } from '../../../src/config/database.js';
import { v4 as uuidv4 } from 'uuid';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

describe('TickRetentionJob', () => {
  let job: TickRetentionJob;
  const testSymbol = `RET${uuidv4().replace(/-/g, '').slice(0, 5).toUpperCase()}/USD`;

  beforeAll(async () => {
    job = new TickRetentionJob(3600000);
    if (!skipDatabaseTests) {
      await pgPool.query(
        `INSERT INTO trading.assets (symbol, name, asset_type, is_active)
         VALUES ($1, 'Retention Test Asset', 'forex', TRUE)
         ON CONFLICT (symbol) DO NOTHING`,
        [testSymbol]
      );
    }
  });

  afterAll(async () => {
    await job.stop();
    if (!skipDatabaseTests) {
      await pgPool.query('DELETE FROM pricing.price_ticks WHERE symbol = $1', [testSymbol]);
      await pgPool.query('DELETE FROM pricing.candles WHERE symbol = $1', [testSymbol]);
      await pgPool.query('DELETE FROM trading.asset_config WHERE asset_symbol = $1', [testSymbol]);
      await pgPool.query('DELETE FROM trading.assets WHERE symbol = $1', [testSymbol]);
    }
  });

  test('prunes price ticks older than TICK_RETENTION_HOURS and candles older than CANDLE_RETENTION_DAYS', async () => {
    if (skipDatabaseTests) return;

    process.env.TICK_RETENTION_HOURS = '48';
    process.env.CANDLE_RETENTION_DAYS = '30';

    const now = new Date();
    const oldTickTime = new Date(now.getTime() - 49 * 60 * 60 * 1000); // 49 hours ago
    const freshTickTime = new Date(now.getTime() - 47 * 60 * 60 * 1000); // 47 hours ago
    const oldCandleTime = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
    const freshCandleTime = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000); // 29 days ago

    // Insert test ticks
    const oldTickRes = await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, tick_time, bid_price, ask_price, mid_price, source)
       VALUES ($1, $2, '1.1000', '1.1002', '1.1001', 'live')
       RETURNING id`,
      [testSymbol, oldTickTime]
    );
    const oldTickId = oldTickRes.rows[0].id;

    const freshTickRes = await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, tick_time, bid_price, ask_price, mid_price, source)
       VALUES ($1, $2, '1.1000', '1.1002', '1.1001', 'live')
       RETURNING id`,
      [testSymbol, freshTickTime]
    );
    const freshTickId = freshTickRes.rows[0].id;

    // Insert test candles
    const oldCandleCloseTime = new Date(oldCandleTime.getTime() + 60000);
    const freshCandleCloseTime = new Date(freshCandleTime.getTime() + 60000);

    const oldCandleRes = await pgPool.query(
      `INSERT INTO pricing.candles (symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume)
       VALUES ($1, 60, $2, $3, '1.1000', '1.1010', '1.0990', '1.1005', 100)
       RETURNING id`,
      [testSymbol, oldCandleTime, oldCandleCloseTime]
    );
    const oldCandleId = oldCandleRes.rows[0].id;

    const freshCandleRes = await pgPool.query(
      `INSERT INTO pricing.candles (symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume)
       VALUES ($1, 60, $2, $3, '1.1000', '1.1010', '1.0990', '1.1005', 100)
       RETURNING id`,
      [testSymbol, freshCandleTime, freshCandleCloseTime]
    );
    const freshCandleId = freshCandleRes.rows[0].id;

    // Execute retention cleanup
    const result = await job.runCleanup();

    expect(result.deletedTicks).toBeGreaterThanOrEqual(1);
    expect(result.deletedCandles).toBeGreaterThanOrEqual(1);

    // Verify 49h tick is deleted
    const oldTickCheck = await pgPool.query('SELECT 1 FROM pricing.price_ticks WHERE id = $1', [oldTickId]);
    expect(oldTickCheck.rows.length).toBe(0);

    // Verify 47h tick remains
    const freshTickCheck = await pgPool.query('SELECT 1 FROM pricing.price_ticks WHERE id = $1', [freshTickId]);
    expect(freshTickCheck.rows.length).toBe(1);

    // Verify 31-day candle is deleted
    const oldCandleCheck = await pgPool.query('SELECT 1 FROM pricing.candles WHERE id = $1', [oldCandleId]);
    expect(oldCandleCheck.rows.length).toBe(0);

    // Verify 29-day candle remains
    const freshCandleCheck = await pgPool.query('SELECT 1 FROM pricing.candles WHERE id = $1', [freshCandleId]);
    expect(freshCandleCheck.rows.length).toBe(1);
  });
});
