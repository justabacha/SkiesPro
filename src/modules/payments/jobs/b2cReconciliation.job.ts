import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { Decimal } from 'decimal.js';
import { config } from '../../../config/app.js';
import { logger } from '../../../shared/middleware/logger.js';
import { WalletService } from '../../wallet/services/walletService.js';

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
      const processingTimeoutSeconds = Number(
        process.env.B2C_PROCESSING_TIMEOUT_SECONDS ?? config.b2cProcessingTimeoutSeconds ?? 300
      );

      const recoveringRows = await this.pgPool.query<{
        outbox_id: string;
        withdrawal_id: string;
        originator_conversation_id: string;
        old_attempt_count: number;
        new_attempt_count: number;
        new_status: 'pending' | 'dead';
      }>(
        `WITH stale AS (
           SELECT id, withdrawal_id, originator_conversation_id, attempt_count, max_attempts
           FROM payments.b2c_outbox
           WHERE status = 'processing'
             AND updated_at < NOW() - ($1::int || ' seconds')::INTERVAL
           ORDER BY updated_at ASC
           FOR UPDATE SKIP LOCKED
         )
         UPDATE payments.b2c_outbox o
         SET status = CASE
               WHEN stale.attempt_count + 1 >= stale.max_attempts THEN 'dead'
               ELSE 'pending'
             END,
             attempt_count = stale.attempt_count + 1,
             last_error = 'Processing timed out; worker crash lost the in-flight payout; ' ||
               CASE
                 WHEN stale.attempt_count + 1 >= stale.max_attempts THEN 'dead-lettered'
                 ELSE 'retry scheduled'
               END,
             next_attempt_at = CASE
               WHEN stale.attempt_count + 1 >= stale.max_attempts THEN o.next_attempt_at
               ELSE NOW() + ((LEAST(60 * POWER(2, stale.attempt_count), 900)) || ' seconds')::INTERVAL
             END,
             updated_at = NOW()
         FROM stale
         WHERE o.id = stale.id
         RETURNING
           o.id AS outbox_id,
           o.withdrawal_id,
           o.originator_conversation_id,
           stale.attempt_count AS old_attempt_count,
           stale.attempt_count + 1 AS new_attempt_count,
           CASE
             WHEN stale.attempt_count + 1 >= stale.max_attempts THEN 'dead'
             ELSE 'pending'
           END AS new_status`,
        [processingTimeoutSeconds]
      );

      for (const row of recoveringRows.rows) {
        const correlationId = randomUUID();

        if (row.new_status === 'dead') {
          const withdrawalRes = await this.pgPool.query<{ user_id: string; amount: string; status: string }>(
            `SELECT user_id, amount, status
             FROM payments.withdrawals
             WHERE id = $1
             FOR UPDATE`,
            [row.withdrawal_id]
          );

          const withdrawal = withdrawalRes.rows[0];
          if (withdrawal && withdrawal.status === 'dispatched') {
            const walletService = new WalletService();
            await walletService.unlockFunds(withdrawal.user_id, 'real', new Decimal(withdrawal.amount));
            await this.pgPool.query(
              `UPDATE payments.withdrawals
               SET status = 'failed'
               WHERE id = $1 AND status = 'dispatched'`,
              [row.withdrawal_id]
            );
          }
        }

        logger.warn('Recovered stale B2C processing row', {
          correlationId,
          outboxId: row.outbox_id,
          originatorConversationId: row.originator_conversation_id,
          withdrawalId: row.withdrawal_id,
          oldAttemptCount: row.old_attempt_count,
          newAttemptCount: row.new_attempt_count,
          newStatus: row.new_status,
        });
      }

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
