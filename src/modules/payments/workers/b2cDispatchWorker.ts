import { Pool } from 'pg';
import { Decimal } from 'decimal.js';
import { pgPool } from '../../../config/database.js';
import { config } from '../../../config/app.js';
import { logger } from '../../../shared/middleware/logger.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { IB2CPayoutGateway, B2CPayoutRequest } from '../adapters/mpesa/IB2CPayoutGateway.js';
import { getB2CGateway } from '../adapters/mpesa/B2CGatewayFactory.js';

function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return '****';
  return `${phone.substring(0, 6)}***${phone.substring(phone.length - 2)}`;
}

export class B2CDispatchWorker {
  private pool: Pool;
  private gateway: IB2CPayoutGateway;
  private intervalMs: number;
  private batchSize: number;
  private running: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private currentBatchPromise: Promise<void> | null = null;

  constructor(
    pool: Pool = pgPool,
    gateway: IB2CPayoutGateway = getB2CGateway(),
    intervalMs: number = config.b2cWorkerIntervalMs,
    batchSize: number = config.b2cWorkerBatchSize
  ) {
    this.pool = pool;
    this.gateway = gateway;
    this.intervalMs = intervalMs;
    this.batchSize = batchSize;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    logger.info('B2C Dispatch Worker starting...', {
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
    });

    const loop = async () => {
      while (this.running) {
        try {
          this.currentBatchPromise = this.processBatch();
          await this.currentBatchPromise;
        } catch (err: any) {
          logger.error('Unexpected error in B2C Dispatch Worker batch loop', {
            error: err.message,
          });
        } finally {
          this.currentBatchPromise = null;
        }

        if (this.running) {
          await new Promise((resolve) => {
            this.timer = setTimeout(resolve, this.intervalMs);
          });
          this.timer = null;
        }
      }
    };

    loop().catch((err) => {
      logger.error('B2C Dispatch Worker unhandled loop error', {
        error: err.message,
      });
    });
  }

  async stop(): Promise<void> {
    logger.info('Stopping B2C Dispatch Worker...');
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.currentBatchPromise) {
      await this.currentBatchPromise;
    }
    logger.info('B2C Dispatch Worker stopped');
  }


  async processBatch(): Promise<void> {
    const client = await this.pool.connect();
    let claimedRows: any[] = [];

    try {
      await client.query('BEGIN');
      const selectRes = await client.query(
        `SELECT id, withdrawal_id, originator_conversation_id, status, attempt_count, max_attempts, payload
         FROM payments.b2c_outbox
         WHERE status = 'pending' AND next_attempt_at <= NOW()
         ORDER BY next_attempt_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [this.batchSize]
      );

      if (selectRes.rows.length > 0) {
        const ids = selectRes.rows.map((r: any) => r.id);
        await client.query(
          `UPDATE payments.b2c_outbox
           SET status = 'processing', updated_at = NOW()
           WHERE id = ANY($1::uuid[])`,
          [ids]
        );
        claimedRows = selectRes.rows;
      }
      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to claim B2C outbox rows', { error: err.message });
      return;
    } finally {
      client.release();
    }

    for (const row of claimedRows) {
      await this.dispatchRow(row);
    }
  }

  private async finalizeFailedDeadLetter(row: any): Promise<void> {
    const withdrawalRes = await this.pool.query(
      `SELECT w.id, w.user_id, w.amount, w.status
       FROM payments.withdrawals w
       WHERE w.id = $1
       FOR UPDATE`,
      [row.withdrawal_id]
    );

    const withdrawal = withdrawalRes.rows[0];
    if (!withdrawal) {
      logger.warn('B2C dead-letter cleanup skipped: withdrawal not found', {
        outboxId: row.id,
        withdrawalId: row.withdrawal_id,
      });
      return;
    }

    if (withdrawal.status !== 'dispatched') {
      logger.info('B2C dead-letter cleanup skipped: withdrawal not dispatched', {
        outboxId: row.id,
        withdrawalId: row.withdrawal_id,
        withdrawalStatus: withdrawal.status,
      });
      return;
    }

    try {
      const walletService = new WalletService();
      await walletService.unlockFunds(withdrawal.user_id, 'real', new Decimal(withdrawal.amount));

      await this.pool.query(
        `UPDATE payments.withdrawals
         SET status = 'failed'
         WHERE id = $1 AND status = 'dispatched'`,
        [withdrawal.id]
      );

      logger.warn('B2C dead-letter cleanup unlocked funds and failed withdrawal', {
        outboxId: row.id,
        withdrawalId: row.withdrawal_id,
        userId: withdrawal.user_id,
        amount: withdrawal.amount,
      });
    } catch (err: any) {
      logger.error('B2C dead-letter cleanup failed', {
        outboxId: row.id,
        withdrawalId: row.withdrawal_id,
        error: err.message,
      });
      throw err;
    }
  }

  private async dispatchRow(row: any): Promise<void> {
    if (!config.enableB2cDisbursement) {
      logger.warn('B2C worker skipping dispatch — ENABLE_B2C_DISBURSEMENT is false', {
        outboxId: row.id,
      });
      await this.pool.query(
        `UPDATE payments.b2c_outbox SET status = 'pending', updated_at = NOW() WHERE id = $1`,
        [row.id]
      );
      return;
    }

    try {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid outbox payload: expected object');
      }
      const recipientPhone = payload.recipientPhone;
      if (!recipientPhone) {
        throw new Error('Invalid outbox payload: recipientPhone missing');
      }
      if (!payload.netAmount) {
        throw new Error('Invalid outbox payload: netAmount missing');
      }
      const amount = new Decimal(payload.netAmount);

      logger.info('B2C Dispatch Worker processing payout dispatch', {
        correlationId: row.id,
        outboxId: row.id,
        withdrawalId: row.withdrawal_id,
        originatorConversationId: row.originator_conversation_id,
        recipientPhone: maskPhone(recipientPhone),
        amount: amount.toString(),
      });

      const req: B2CPayoutRequest = {
        originatorConversationId: row.originator_conversation_id,
        amount,
        recipientPhone,
        remarks: payload.remarks || 'Payout',
        occasion: payload.occasion,
      };

      const response = await this.gateway.initiateB2CPayout(req);

      const rawObj = response.raw && typeof response.raw === 'object' ? (response.raw as any) : {};
      const trackingId = String(rawObj.tracking_id || rawObj.batch?.tracking_id || '');

      await this.pool.query(
        `UPDATE payments.b2c_outbox
         SET status = 'sent',
             conversation_id = $1,
             gateway_tracking_id = COALESCE(NULLIF($3::text, ''), gateway_tracking_id),
             processed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [response.conversationId, row.id, trackingId]
      );

      if (!trackingId.trim()) {
        logger.warn('B2C response missing tracking_id; leaving gateway_tracking_id unset', {
          correlationId: row.id,
          outboxId: row.id,
          withdrawalId: row.withdrawal_id,
          conversationId: response.conversationId,
        });
      }

      logger.info('B2C Dispatch Worker successfully dispatched payout', {
        correlationId: row.id,
        outboxId: row.id,
        withdrawalId: row.withdrawal_id,
        conversationId: response.conversationId,
      });
    } catch (error: any) {
      const attemptCount = (row.attempt_count || 0) + 1;
      const maxAttempts = row.max_attempts || 5;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (error?.outcome === 'possibly_sent') {
        await this.pool.query(
          `UPDATE payments.b2c_outbox
           SET status = 'needs_review',
               attempt_count = attempt_count + 1,
               last_error = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [
            `AMBIGUOUS — payout may have been sent. Check IntaSend dashboard before manual retry. Original: ${errorMessage}`,
            row.id,
          ]
        );

        logger.error('B2C dispatch AMBIGUOUS — marked needs_review', {
          correlationId: row.id,
          outboxId: row.id,
          withdrawalId: row.withdrawal_id,
          error: errorMessage,
        });
        return;
      }

      if (attemptCount >= maxAttempts) {
        await this.pool.query(
          `UPDATE payments.b2c_outbox
           SET status = 'dead',
               attempt_count = $1,
               last_error = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [attemptCount, errorMessage, row.id]
        );

        await this.finalizeFailedDeadLetter(row);

        logger.warn('B2C Dispatch Worker outbox row reached max attempts, marked dead-letter', {
          correlationId: row.id,
          outboxId: row.id,
          withdrawalId: row.withdrawal_id,
          attemptCount,
          maxAttempts,
          error: errorMessage,
        });
      } else {
        const delaySec = Math.min(60 * Math.pow(2, attemptCount - 1), 900);

        await this.pool.query(
          `UPDATE payments.b2c_outbox
           SET status = 'pending',
               attempt_count = $1,
               last_error = $2,
               next_attempt_at = NOW() + ($3 || ' seconds')::INTERVAL,
               updated_at = NOW()
           WHERE id = $4`,
          [attemptCount, errorMessage, `${delaySec}`, row.id]
        );

        logger.error('B2C Dispatch Worker payout dispatch failed, scheduled retry', {
          correlationId: row.id,
          outboxId: row.id,
          withdrawalId: row.withdrawal_id,
          attemptCount,
          maxAttempts,
          nextAttemptInSec: delaySec,
          error: errorMessage,
        });
      }
    }
  }
}
