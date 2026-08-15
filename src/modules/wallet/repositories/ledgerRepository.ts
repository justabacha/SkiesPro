import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository';

export interface LedgerRow {
  id: string;
  transaction_id: string;
  wallet_id: string;
  entry_type: 'credit' | 'debit';
  amount: string;
  balance_before: string;
  balance_after: string;
  reference_type: string;
  reference_id: string | null;
  description: string | null;
  created_at: Date;
}

export class LedgerRepository extends BaseRepository {
  constructor(client?: PoolClient) {
    super(client);
  }

  async create(data: Omit<LedgerRow, 'id' | 'created_at'>): Promise<LedgerRow> {
    const result = await this.query<LedgerRow>(
      `INSERT INTO wallet.ledger_entries (
        transaction_id, wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.transaction_id,
        data.wallet_id,
        data.entry_type,
        data.amount,
        data.balance_before,
        data.balance_after,
        data.reference_type,
        data.reference_id,
        data.description,
      ]
    );
    return result.rows[0];
  }

  async findByWalletId(
    walletId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<LedgerRow[]> {
    let query = 'SELECT * FROM wallet.ledger_entries WHERE wallet_id = $1';
    const params: any[] = [walletId];

    if (cursor) {
      query += ' AND created_at < $2';
      params.push(new Date(cursor));
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.query<LedgerRow>(query, params);
    return result.rows;
  }

  async sumByWalletId(walletId: string): Promise<string> {
    const result = await this.query(
      `SELECT SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END) as total
       FROM wallet.ledger_entries
       WHERE wallet_id = $1`,
      [walletId]
    );
    return result.rows[0].total || '0.0000';
  }
}
