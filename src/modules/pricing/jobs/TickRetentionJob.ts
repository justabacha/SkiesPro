import { pgPool } from '../../../config/database.js';
import { logger } from '../../../shared/middleware/logger.js';

export class TickRetentionJob {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly intervalMs: number = 60 * 60 * 1000) {} // Default 1 hour

  async start(): Promise<void> {
    logger.info('Tick Retention Job starting...', { intervalMs: this.intervalMs });
    await this.runCleanup();
    this.timer = setInterval(async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.runCleanup();
      } catch (err: any) {
        logger.error('Error running tick retention job', { error: err.message });
      } finally {
        this.isRunning = false;
      }
    }, this.intervalMs);
    this.timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Tick Retention Job stopped');
  }

  async runCleanup(): Promise<{ deletedTicks: number; deletedCandles: number }> {
    const tickRetentionHours = parseInt(process.env.TICK_RETENTION_HOURS || '48', 10);
    const candleRetentionDays = parseInt(process.env.CANDLE_RETENTION_DAYS || '30', 10);

    const tickQuery = `
      WITH expired AS (
        SELECT id
        FROM pricing.price_ticks
        WHERE tick_time < NOW() - ($1 || ' hours')::INTERVAL
        ORDER BY tick_time
        LIMIT 5000
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM pricing.price_ticks AS ticks
      USING expired
      WHERE ticks.id = expired.id
    `;
    const candleQuery = `
      WITH expired AS (
        SELECT id
        FROM pricing.candles
        WHERE open_time < NOW() - ($1 || ' days')::INTERVAL
        ORDER BY open_time
        LIMIT 5000
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM pricing.candles AS candles
      USING expired
      WHERE candles.id = expired.id
    `;

    const deleteInBatches = async (query: string, retention: number): Promise<number> => {
      let totalDeleted = 0;
      let batchDeleted: number;

      do {
        const client = await pgPool.connect();
        try {
          await client.query('BEGIN');
          await client.query("SET LOCAL statement_timeout = '30s'");
          await client.query("SET LOCAL lock_timeout = '5s'");
          const result = await client.query(query, [retention]);
          batchDeleted = result.rowCount ?? 0;
          await client.query('COMMIT');
        } catch (error) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            logger.error('Failed to roll back retention batch', {
              error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
            });
          }
          throw error;
        } finally {
          client.release();
        }

        totalDeleted += batchDeleted;
        if (batchDeleted === 5000) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } while (batchDeleted === 5000);

      return totalDeleted;
    };

    const deletedTicks = await deleteInBatches(tickQuery, tickRetentionHours);
    const deletedCandles = await deleteInBatches(candleQuery, candleRetentionDays);

    logger.info('TickRetentionJob completed cleanup', {
      deletedTicks,
      deletedCandles,
      tickRetentionHours,
      candleRetentionDays,
    });

    return { deletedTicks, deletedCandles };
  }
}

export const tickRetentionJob = new TickRetentionJob();
