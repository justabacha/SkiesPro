import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository.js';

export interface DepositRow {
  id: string;
  user_id: string;
  gateway_id: number;
  gateway_reference: string;
  amount: string;
  fee: string;
  net_amount: string;
  currency: string;
  status: string;
  webhook_payload: any;
  idempotency_key: string;
  completed_at: Date | null;
  created_at: Date;
}

export interface WithdrawalRow {
  id: string;
  user_id: string;
  gateway_id: number;
  amount: string;
  fee: string;
  net_amount: string;
  currency: string;
  status: string;
  reviewed_by: string | null;
  review_note: string | null;
  gateway_reference: string | null;
  idempotency_key: string;
  completed_at: Date | null;
  created_at: Date;
}

export class PaymentRepository extends BaseRepository {
  constructor(client?: PoolClient) {
    super(client);
  }

  async findIdempotencyKey(key: string): Promise<any | null> {
    const result = await this.query(
      'SELECT response FROM payments.idempotency_keys WHERE key = $1 AND expires_at > NOW()',
      [key]
    );
    return result.rows[0]?.response || null;
  }

  async saveIdempotencyKey(key: string, response: any): Promise<void> {
    await this.query(
      'INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET response = $2',
      [key, response]
    );
  }

  async createDeposit(
    data: Omit<DepositRow, 'id' | 'created_at' | 'completed_at'>
  ): Promise<DepositRow> {
    const result = await this.query<DepositRow>(
      `INSERT INTO payments.deposits (
        user_id, gateway_id, gateway_reference, amount, fee, net_amount, currency, status, webhook_payload, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        data.user_id,
        data.gateway_id,
        data.gateway_reference,
        data.amount,
        data.fee,
        data.net_amount,
        data.currency,
        data.status,
        data.webhook_payload,
        data.idempotency_key,
      ]
    );
    return result.rows[0];
  }

  async findDepositByReference(reference: string): Promise<DepositRow | null> {
    const result = await this.query<DepositRow>(
      'SELECT * FROM payments.deposits WHERE gateway_reference = $1',
      [reference]
    );
    return result.rows[0] || null;
  }

  async findDepositByReferenceForUpdate(reference: string): Promise<DepositRow | null> {
    const result = await this.query<DepositRow>(
      'SELECT * FROM payments.deposits WHERE gateway_reference = $1 FOR UPDATE',
      [reference]
    );
    return result.rows[0] || null;
  }

  async updateDepositStatus(id: string, status: string, webhookPayload?: any): Promise<DepositRow> {
    const result = await this.query<DepositRow>(
      `UPDATE payments.deposits
       SET status = $1::text, webhook_payload = COALESCE($2::jsonb, webhook_payload), completed_at = CASE WHEN $1::text = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $3
       RETURNING *`,
      [status, webhookPayload ? JSON.stringify(webhookPayload) : null, id]
    );
    return result.rows[0];
  }

  async createWithdrawal(
    data: Omit<
      WithdrawalRow,
      'id' | 'created_at' | 'completed_at' | 'reviewed_by' | 'review_note' | 'gateway_reference'
    >
  ): Promise<WithdrawalRow> {
    const result = await this.query<WithdrawalRow>(
      `INSERT INTO payments.withdrawals (
        user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.user_id,
        data.gateway_id,
        data.amount,
        data.fee,
        data.net_amount,
        data.currency,
        data.status,
        data.idempotency_key,
      ]
    );
    return result.rows[0];
  }

  async findWithdrawalById(id: string): Promise<WithdrawalRow | null> {
    const result = await this.query<WithdrawalRow>(
      'SELECT * FROM payments.withdrawals WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findOutboxByOriginatorConversationIdForUpdate(originatorConversationId: string): Promise<any | null> {
    const result = await this.query<any>(
      'SELECT * FROM payments.b2c_outbox WHERE originator_conversation_id = $1 FOR UPDATE',
      [originatorConversationId]
    );
    return result.rows[0] || null;
  }

  async findLatestOutboxByWithdrawalIdForUpdate(withdrawalId: string): Promise<any | null> {
    const result = await this.query<any>(
      'SELECT * FROM payments.b2c_outbox WHERE withdrawal_id = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE',
      [withdrawalId]
    );
    return result.rows[0] || null;
  }

  async resetOutboxForRetry(id: string, newOriginatorId: string, payload?: Record<string, unknown>): Promise<any> {
    const result = await this.query<any>(
      `UPDATE payments.b2c_outbox
       SET status = 'pending',
           attempt_count = 0,
           next_attempt_at = NOW(),
           originator_conversation_id = $2,
           retry_count = retry_count + 1,
           needs_manual_review = false,
           manual_review_reason = NULL,
           last_error = NULL,
           processed_at = NULL,
           conversation_id = NULL,
           payload = COALESCE($3::jsonb, payload),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, newOriginatorId, payload ? JSON.stringify(payload) : null]
    );
    return result.rows[0];
  }

  async clearManualReviewFlag(id: string): Promise<void> {
    await this.query(
      `UPDATE payments.b2c_outbox
       SET needs_manual_review = false,
           manual_review_reason = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async updateOutboxStatus(
    id: string,
    status: string,
    conversationId?: string | null,
    lastError?: string | null,
    nextAttemptAt?: Date | null
  ): Promise<any> {
    const result = await this.query<any>(
      `UPDATE payments.b2c_outbox
       SET status = $1::text,
           conversation_id = COALESCE($2::text, conversation_id),
           last_error = COALESCE($3::text, last_error),
           next_attempt_at = COALESCE($4::timestamptz, next_attempt_at),
           processed_at = CASE WHEN $1::text IN ('sent', 'failed', 'dead') THEN NOW() ELSE processed_at END,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, conversationId || null, lastError || null, nextAttemptAt || null, id]
    );
    return result.rows[0];
  }

  async updateWithdrawalStatusAndRef(
    id: string,
    status: string,
    gatewayReference?: string | null
  ): Promise<WithdrawalRow> {
    const result = await this.query<WithdrawalRow>(
      `UPDATE payments.withdrawals
       SET status = $1::text,
           gateway_reference = COALESCE($2::text, gateway_reference),
           completed_at = CASE WHEN $1::text = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $3
       RETURNING *`,
      [status, gatewayReference || null, id]
    );
    return result.rows[0];
  }

  async logWebhook(
    gatewayId: number,
    headers: any,
    body: any,
    signatureValid: boolean
  ): Promise<void> {
    await this.query(
      `INSERT INTO payments.payment_webhook_logs (gateway_id, headers, body, signature_valid)
       VALUES ($1, $2, $3, $4)`,
      [gatewayId, JSON.stringify(headers), JSON.stringify(body), signatureValid]
    );
  }
}
