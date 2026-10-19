import { Pool } from 'pg';
import { Decimal } from 'decimal.js';
import { pgPool } from '../../../config/database.js';
import { config } from '../../../config/app.js';
import { logger } from '../../../shared/middleware/logger.js';
import {
  IB2CPayoutGateway,
  B2CPayoutRequest,
} from '../adapters/mpesa/IB2CPayoutGateway.js';
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

    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    const amount = new Decimal(payload.amount);
    const recipientPhone = payload.recipientPhone;

    logger.info('B2C Dispatch Worker processing payout dispatch', {
      outboxId: row.id,
      withdrawalId: row.withdrawal_id,
      originatorConversationId: row.originator_conversation_id,
      recipientPhone: maskPhone(recipientPhone),
      amount: amount.toString(),
    });

    try {
      const req: B2CPayoutRequest = {
        originatorConversationId: row.originator_conversation_id,
        amount,
        recipientPhone,
        remarks: payload.remarks || 'Payout',
        occasion: payload.occasion,
      };

      const response = await this.gateway.initiateB2CPayout(req);

      await this.pool.query(
        `UPDATE payments.b2c_outbox
         SET status = 'sent',
             conversation_id = $1,
             processed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [response.conversationId, row.id]
      );

      logger.info('B2C Dispatch Worker successfully dispatched payout', {
        outboxId: row.id,
        withdrawalId: row.withdrawal_id,
        conversationId: response.conversationId,
      });
    } catch (error: any) {
      const attemptCount = (row.attempt_count || 0) + 1;
      const maxAttempts = row.max_attempts || 5;
      const errorMessage = error instanceof Error ? error.message : String(error);

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

        logger.warn('B2C Dispatch Worker outbox row reached max attempts, marked dead-letter', {
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
