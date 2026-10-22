import { Pool } from 'pg';
import { logger } from '../../../shared/middleware/logger.js';

export class B2CReconciliationJob {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly pgPool: Pool,
    private readonly intervalMs: number = 300000,
    private readonly isEnabled: () => boolean = () => true
  ) {}

  async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    logger.info('Starting B2C reconciliation job', { intervalMs: this.intervalMs });
    this.timer = setInterval(() => {
      this.runTick().catch((err) => {
        logger.error('Error executing B2C reconciliation tick', { error: (err as Error).message });
      });
    }, this.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Stopped B2C reconciliation job');
    }
  }

  async runTick(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    if (!this.isEnabled()) {
      logger.info('B2C reconciliation disabled via config; skipping tick');
      return;
    }

    this.isRunning = true;
    try {
      // Query 1: Flag stuck > 2h (unreviewed)
      const res2h = await this.pgPool.query<{ id: string; withdrawal_id: string }>(
        `UPDATE payments.b2c_outbox o
         SET needs_manual_review = true,
             manual_review_reason = 'Stuck at 2h threshold; no result callback received',
             updated_at = NOW()
         FROM payments.withdrawals w
         WHERE o.withdrawal_id = w.id
           AND w.status = 'dispatched'
           AND o.status = 'sent'
           AND o.processed_at IS NULL
           AND o.needs_manual_review = false
           AND o.updated_at < NOW() - INTERVAL '2 hours'
         RETURNING o.id, o.withdrawal_id`
      );

      for (const row of res2h.rows) {
        logger.warn('Flagged stuck B2C outbox row for manual review', {
          event: 'b2c_reconciliation_flagged_2h',
          outboxId: row.id,
          withdrawalId: row.withdrawal_id,
        });
      }

      // Query 2: Escalate stuck > 24h (still unreviewed by ops)
      const res24h = await this.pgPool.query<{ id: string; withdrawal_id: string }>(
        `UPDATE payments.b2c_outbox o
         SET manual_review_reason = 'Stuck at 24h threshold; escalated for ops intervention',
             updated_at = NOW()
         FROM payments.withdrawals w
         WHERE o.withdrawal_id = w.id
           AND w.status = 'dispatched'
           AND o.status = 'sent'
           AND o.processed_at IS NULL
           AND o.needs_manual_review = true
           AND o.manual_review_reason LIKE 'Stuck at 2h%'
           AND o.updated_at < NOW() - INTERVAL '24 hours'
         RETURNING o.id, o.withdrawal_id`
      );

      for (const row of res24h.rows) {
        logger.warn('Escalated stuck B2C outbox row to 24h threshold', {
          event: 'b2c_reconciliation_escalated_24h',
          outboxId: row.id,
          withdrawalId: row.withdrawal_id,
        });
      }

      // Query 3: Count dead dispatches (visibility only)
      const resDead = await this.pgPool.query<{ dead_count: number }>(
        `SELECT COUNT(*)::int AS dead_count
         FROM payments.b2c_outbox
         WHERE status = 'dead'
           AND needs_manual_review = false
           AND updated_at > NOW() - INTERVAL '1 hour'`
      );

      const deadCount = resDead.rows[0]?.dead_count || 0;
      if (deadCount > 0) {
        logger.error('Recent dead B2C dispatches detected', {
          event: 'b2c_dead_dispatches',
          count: deadCount,
        });
      }
    } finally {
      this.isRunning = false;
    }
  }
}
