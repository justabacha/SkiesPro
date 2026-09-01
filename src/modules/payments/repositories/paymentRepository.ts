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
