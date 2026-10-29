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
      DELETE FROM pricing.price_ticks
      WHERE tick_time < NOW() - ($1 || ' hours')::INTERVAL
    `;
    const candleQuery = `
      DELETE FROM pricing.candles
      WHERE open_time < NOW() - ($1 || ' days')::INTERVAL
    `;

    const tickResult = await pgPool.query(tickQuery, [tickRetentionHours]);
    const candleResult = await pgPool.query(candleQuery, [candleRetentionDays]);

    const deletedTicks = tickResult.rowCount ?? 0;
    const deletedCandles = candleResult.rowCount ?? 0;

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
