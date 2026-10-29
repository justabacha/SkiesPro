import { pgPool } from '../../../config/database.js';
import { logger } from '../../../shared/middleware/logger.js';

export class SettlementRecoveryJob {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly intervalMs: number = 60000) {}

  async start(): Promise<void> {
    logger.info('Settlement Recovery Job starting...', { intervalMs: this.intervalMs });
    await this.recoverOrphanedSettlingContracts();
    this.timer = setInterval(async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.recoverOrphanedSettlingContracts();
      } catch (err: any) {
        logger.error('Error running settlement recovery job', { error: err.message });
      } finally {
        this.isRunning = false;
      }
    }, this.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Settlement Recovery Job stopped');
  }

  async recoverOrphanedSettlingContracts(): Promise<number> {
    const query = `
      UPDATE trading.binary_contracts
      SET status = 'active'
      WHERE status = 'settling'
        AND expiry_time < NOW() - INTERVAL '30 seconds'
      RETURNING id, account_type
    `;
    const result = await pgPool.query<{ id: string; account_type: string }>(query);
    const recovered = result.rows;

    for (const contract of recovered) {
      logger.warn('Recovered orphaned settling contract', {
        contractId: contract.id,
        accountType: contract.account_type,
      });
    }

    return recovered.length;
  }
}
